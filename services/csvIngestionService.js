import fs from "fs";
import { Readable } from "stream";
import csv from "csv-parser";
import pool from "../config/db.js";
import { uuidv7 } from "uuidv7";
import { getAgeGroup, pickBestCountry } from "../utils/helpers.js";

/**
 * CSV Ingestion Service
 * Handles streaming CSV uploads with batch processing
 * Validates rows and skips invalid entries
 * Non-blocking, concurrent-safe
 */

const BATCH_SIZE = 500; // Process 500 rows per batch
const REQUIRED_FIELDS = ["name"];
const OPTIONAL_FIELDS = ["gender", "age", "country_id", "country_name", "gender_probability", "country_probability"];
const VALID_GENDERS = ["male", "female"];
const VALID_COUNTRIES = {
  NG: "Nigeria",
  KE: "Kenya",
  GH: "Ghana",
  EG: "Egypt",
  AO: "Angola",
  ZA: "South Africa",
  UG: "Uganda",
  TZ: "Tanzania",
  GB: "United Kingdom",
  FR: "France",
  DE: "Germany",
  IT: "Italy",
  ES: "Spain",
  US: "United States",
  CA: "Canada",
  BR: "Brazil",
  MX: "Mexico",
  CN: "China",
  IN: "India",
  JP: "Japan",
  PK: "Pakistan",
};

/**
 * Validate a single row
 * Returns { isValid, error, reason }
 */
function validateRow(row, existingNames, existingDbNames) {
  if (!row.name || typeof row.name !== "string") {
    return { isValid: false, reason: "missing_fields" };
  }

  const name = row.name.trim().toLowerCase();
  if (name.length === 0) {
    return { isValid: false, reason: "missing_fields" };
  }

  if (existingNames.has(name) || existingDbNames.has(name)) {
    return { isValid: false, reason: "duplicate_name" };
  }

  if (row.age !== undefined && row.age !== "") {
    const age = parseInt(row.age, 10);
    if (isNaN(age) || age < 0 || age > 150) {
      return { isValid: false, reason: "invalid_age" };
    }
  }

  if (row.gender !== undefined && row.gender !== "") {
    const gender = String(row.gender).toLowerCase().trim();
    if (!VALID_GENDERS.includes(gender)) {
      return { isValid: false, reason: "invalid_gender" };
    }
  }

  if (row.country_id !== undefined && row.country_id !== "") {
    const countryId = String(row.country_id).toUpperCase().trim();
    if (!VALID_COUNTRIES[countryId]) {
      return { isValid: false, reason: "invalid_country" };
    }
  }

  if (row.gender_probability !== undefined && row.gender_probability !== "") {
    const prob = parseFloat(row.gender_probability);
    if (isNaN(prob) || prob < 0 || prob > 1) {
      return { isValid: false, reason: "invalid_probability" };
    }
  }

  if (row.country_probability !== undefined && row.country_probability !== "") {
    const prob = parseFloat(row.country_probability);
    if (isNaN(prob) || prob < 0 || prob > 1) {
      return { isValid: false, reason: "invalid_probability" };
    }
  }

  return { isValid: true };
}

async function getExistingNames(rowNames) {
  if (rowNames.size === 0) {
    return new Set();
  }

  const result = await pool.query(
    "SELECT name FROM profiles WHERE name = ANY($1)",
    [Array.from(rowNames)]
  );

  return new Set(result.rows.map((row) => row.name));
}

/**
 * Process a batch of rows
 * Returns { success, failed }
 */
async function processBatch(rows, allExistingNames, stats) {
  const values = [];
  let rowCount = 0;
  const batchNames = new Set();
  const rowNames = new Set();

  for (const row of rows) {
    if (row.name && typeof row.name === "string") {
      rowNames.add(row.name.trim().toLowerCase());
    }
  }

  const existingDbNames = await getExistingNames(rowNames);
  const placeholders = [];

  for (const row of rows) {
    const validation = validateRow(row, new Set([...allExistingNames, ...batchNames]), existingDbNames);

    if (!validation.isValid) {
      stats.skipped++;
      stats.reasons[validation.reason] = (stats.reasons[validation.reason] || 0) + 1;
      continue;
    }

    const name = row.name.trim().toLowerCase();
    batchNames.add(name);
    allExistingNames.add(name);

    const id = uuidv7();
    const gender = row.gender ? String(row.gender).toLowerCase() : null;
    const age = row.age ? parseInt(row.age, 10) : null;
    const ageGroup = age !== null ? getAgeGroup(age) : null;
    const countryId = row.country_id ? String(row.country_id).toUpperCase() : null;
    const countryName = countryId ? VALID_COUNTRIES[countryId] : null;
    const genderProb = row.gender_probability ? parseFloat(row.gender_probability) : null;
    const countryProb = row.country_probability ? parseFloat(row.country_probability) : null;
    const createdAt = new Date().toISOString();

    const paramIndex = rowCount * 10;
    placeholders.push(
      `($${paramIndex + 1},$${paramIndex + 2},$${paramIndex + 3},$${paramIndex + 4},$${paramIndex + 5},$${paramIndex + 6},$${paramIndex + 7},$${paramIndex + 8},$${paramIndex + 9},$${paramIndex + 10})`
    );

    values.push(
      id,
      name,
      gender,
      genderProb,
      age,
      ageGroup,
      countryId,
      countryName,
      countryProb,
      createdAt
    );

    rowCount++;
  }

  if (rowCount === 0) {
    return { success: 0, failed: rows.length };
  }

  try {
    const query = `
      INSERT INTO profiles 
      (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at)
      VALUES ${placeholders.join(",")}
      ON CONFLICT (name) DO NOTHING
    `;

    const result = await pool.query(query, values);
    stats.inserted += result.rowCount;

    return { success: result.rowCount, failed: rows.length - result.rowCount };
  } catch (err) {
    console.error("Batch insert error:", err);
    stats.skipped += rowCount;
    stats.reasons.insert_error = (stats.reasons.insert_error || 0) + rowCount;
    return { success: 0, failed: rows.length };
  }
}

/**
 * Stream process CSV file
 * Returns stats object
 */
export async function processCSVStream(fileStream) {
  return new Promise((resolve, reject) => {
    const stats = {
      status: "success",
      total_rows: 0,
      inserted: 0,
      skipped: 0,
      reasons: {},
    };

    let batch = [];
    const allExistingNames = new Set();

    fileStream
      .pipe(csv())
      .on("data", async (row) => {
        stats.total_rows++;

        batch.push(row);

        // Process batch when it reaches BATCH_SIZE
        if (batch.length >= BATCH_SIZE) {
          const currentBatch = batch;
          batch = [];

          // Pause stream while processing
          fileStream.pause();

          try {
            await processBatch(currentBatch, allExistingNames, stats);
            fileStream.resume();
          } catch (err) {
            fileStream.destroy();
            reject(err);
          }
        }
      })
      .on("end", async () => {
        try {
          // Process remaining rows
          if (batch.length > 0) {
            await processBatch(batch, allExistingNames, stats);
          }

          resolve(stats);
        } catch (err) {
          reject(err);
        }
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

/**
 * Read CSV headers from file path
 * Returns array of header names
 */
export async function readCSVHeadersFromFile(filePath) {
  return new Promise((resolve, reject) => {
    const headers = [];
    const stream = fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headerList) => {
        headers.push(...headerList);
        stream.destroy(); // Stop reading after headers
        resolve(headers);
      })
      .on('error', reject);
  });
}

/**
 * Validate CSV headers
 * Ensures required columns exist
 */
export function validateCSVHeaders(headers) {
  const missingRequired = REQUIRED_FIELDS.filter(field => !headers.includes(field));

  if (missingRequired.length > 0) {
    return {
      isValid: false,
      error: `Missing required columns: ${missingRequired.join(", ")}`,
    };
  }

  return { isValid: true };
}

/**
 * Get expected column names
 */
export function getExpectedColumns() {
  return {
    required: REQUIRED_FIELDS,
    optional: OPTIONAL_FIELDS,
  };
}

export default {
  processCSVStream,
  validateCSVHeaders,
  getExpectedColumns,
  BATCH_SIZE,
};
