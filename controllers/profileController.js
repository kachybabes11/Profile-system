import fs from "fs";
import readline from "readline";
import { uuidv7 } from "uuidv7";
import {
  findByName,
  findById,
  getAll,
  create,
  deleteById,
} from "../models/profileModel.js";

import { fetchExternalData } from "../services/externalApiService.js";
import { getAgeGroup, pickBestCountry } from "../utils/helpers.js";
import { parseQuery } from "../utils/queryParser.js";
import { exportProfilesAsCSV } from "../services/exportService.js";
import { processCSVStream, validateCSVHeaders, readCSVHeadersFromFile } from "../services/csvIngestionService.js";
import { invalidateQueryCache } from "../services/cacheService.js";


// GET ALL PROFILES 
export async function getProfiles(req, res) {
  try {
    const result = await getAll(req.query);

    const totalPages = Math.ceil(result.total / result.limit);
    const nextPage = result.page < totalPages ? result.page + 1 : null;
    const prevPage = result.page > 1 ? result.page - 1 : null;

    res.json({
      status: "success",
      page: result.page,
      limit: result.limit,
      total: result.total,
      total_pages: totalPages,
      data: result.data,
      links: {
        self: `/api/profiles?page=${result.page}&limit=${result.limit}`,
        next: nextPage ? `/api/profiles?page=${nextPage}&limit=${result.limit}` : null,
        prev: prevPage ? `/api/profiles?page=${prevPage}&limit=${result.limit}` : null,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: "error",
      message: err.message,
    });
  }
}


// NATURAL LANGUAGE SEARCH
export async function searchProfiles(req, res) {
  try {
    const parsed = parseQuery(req.query.q);

    if (!parsed) {
      return res.status(400).json({
        status: "error",
        message: "Unable to interpret query",
      });
    }

    const { filters, raw } = parsed;

    const result = await getAll({
      ...filters,
      raw,
      ...req.query,
    });

    const totalPages = Math.ceil(result.total / result.limit);
    const nextPage = result.page < totalPages ? result.page + 1 : null;
    const prevPage = result.page > 1 ? result.page - 1 : null;

    res.json({
      status: "success",
      page: result.page,
      limit: result.limit,
      total: result.total,
      total_pages: totalPages,
      data: result.data,
      links: {
        self: `/api/profiles/search?q=${encodeURIComponent(req.query.q)}&page=${result.page}&limit=${result.limit}`,
        next: nextPage ? `/api/profiles/search?q=${encodeURIComponent(req.query.q)}&page=${nextPage}&limit=${result.limit}` : null,
        prev: prevPage ? `/api/profiles/search?q=${encodeURIComponent(req.query.q)}&page=${prevPage}&limit=${result.limit}` : null,
      },
    });

  } catch (err) {
    res.status(400).json({
      status: "error",
      message: err.message,
    });
  }
}

// CREATE PROFILE
export async function createProfile(req, res) {
  try {
    let { name } = req.body;

    if (!name) {
      return res.status(400).json({
        status: "error",
        message: "Missing or empty name",
      });
    }

    if (typeof name !== "string") {
      return res.status(422).json({
        status: "error",
        message: "Invalid type",
      });
    }

    name = name.trim().toLowerCase();

    const existing = await findByName(name);

    if (existing) {
      return res.json({
        status: "success",
        message: "Profile already exists",
      });
    }

    const { gender, age, nationality } = await fetchExternalData(name);

    if (!gender.gender || gender.count === 0) {
      return res.status(502).json({
        status: "error",
        message: "Genderize returned an invalid response",
      });
    }

    if (!age.age) {
      return res.status(502).json({
        status: "error",
        message: "Agify returned an invalid response",
      });
    }

    if (!nationality.country || nationality.country.length === 0) {
      return res.status(502).json({
        status: "error",
        message: "Nationalize returned an invalid response",
      });
    }

    const bestCountry = pickBestCountry(nationality.country);

    const profile = {
      id: uuidv7(),
      name,
      gender: gender.gender,
      gender_probability: gender.probability,
      age: age.age,
      age_group: getAgeGroup(age.age),
      country_id: bestCountry.country_id,
      country_name: bestCountry.country_name,
      country_probability: bestCountry.probability,
      created_at: new Date().toISOString(),
      created_by: req.user.userId,
    };

    await create(profile);
  const isApiRequest =
  req.originalUrl.startsWith("/api/") ||
  req.headers.accept?.includes("application/json") ||
  req.headers["x-cli-request"] === "true";

if (isApiRequest) {
  return res.status(201).json({
    status: "success",
    data: profile
  });
}

return res.redirect("/dashboard");

  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
}

// GET SINGLE PROFILE
export async function getSingleProfile(req, res) {
  const profile = await findById(req.params.id);

  if (!profile) {
    return res.status(404).json({
      status: "error",
      message: "Profile not found",
    });
  }

  res.json({
    status: "success",
    data: profile,
  });
}

// DELETE PROFILE
export async function deleteProfile(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: "error",
        message: "Profile ID is required"
      });
    }

    const deleted = await deleteById(id);

    if (!deleted) {
      return res.status(404).json({
        status: "error",
        message: "Profile not found"
      });
    }

    // support CLI + Postman + Web
    const wantsJSON =
      req.headers.accept?.includes("application/json") ||
      req.headers["x-cli-request"] === "true" ||
      req.originalUrl.startsWith("/api/");

    if (wantsJSON) {
      return res.status(200).json({
        status: "success",
        message: "Profile deleted successfully",
        data: { id }
      });
    }

    // Web UI fallback
    return res.redirect("/dashboard");

  } catch (err) {
    console.error("DELETE ERROR:", err);

    return res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
}


export async function exportProfiles(req, res) {
  try {
    const csv = await exportProfilesAsCSV(req.query);

    // detect client type (CLI / Postman / Browser)
    const wantsJSON =
      req.headers.accept?.includes("application/json") ||
      req.headers["x-cli-request"] === "true";

    if (wantsJSON) {
      // CLI + Postman
      return res.status(200).json({
        status: "success",
        data: csv
      });
    }

    // Browser download
    res.header("Content-Type", "text/csv");
    res.attachment("profiles.csv");

    return res.send(csv);

  } catch (err) {
    console.error("EXPORT ERROR:", err);

    return res.status(500).json({
      status: "error",
      message: "Failed to export profiles"
    });
  }
}

/**
 * READ CSV HEADERS
 * Reads first line of CSV to validate headers
 */
export async function readCSVHeaders(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "CSV file is required",
      });
    }

    const headers = await readCSVHeadersFromFile(req.file.path);
    const validation = validateCSVHeaders(headers);

    // Clean up temp file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error deleting temp file:", err);
    });

    if (!validation.isValid) {
      return res.status(400).json({
        status: "error",
        message: validation.error,
        headers: headers,
        valid: false,
      });
    }

    return res.json({
      status: "success",
      headers: headers,
      valid: true,
    });

  } catch (err) {
    // Clean up file on error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting temp file on error:", unlinkErr);
      });
    }

    return res.status(400).json({
      status: "error",
      message: err.message,
    });
  }
}

/**
 * UPLOAD PROFILES FROM CSV
 * Streams CSV file, validates rows, batch inserts to database
 * Non-blocking, handles up to 500k rows
 */
export async function uploadProfilesCSV(req, res) {
  try {
    // Check if file is provided
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "CSV file is required. Send as multipart/form-data with field 'file'",
      });
    }

    // Check file type
    if (req.file.mimetype !== "text/csv" && !req.file.originalname.endsWith(".csv")) {
      return res.status(400).json({
        status: "error",
        message: "File must be CSV format",
      });
    }

    // Create readable stream from file path
    const fileStream = fs.createReadStream(req.file.path);

    // Process CSV stream (handles validation, batching, and insertion)
    const stats = await processCSVStream(fileStream);

    // Clean up uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error deleting temp file:", err);
    });

    // Invalidate query cache after bulk insert
    invalidateQueryCache();

    return res.status(201).json({
      status: "success",
      total_rows: stats.total_rows,
      inserted: stats.inserted,
      skipped: stats.skipped,
      reasons: stats.reasons,
    });

  } catch (err) {
    console.error("CSV UPLOAD ERROR:", err);

    // Clean up file on error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting temp file on error:", unlinkErr);
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Failed to process CSV upload",
      details: err.message,
    });
  }
}