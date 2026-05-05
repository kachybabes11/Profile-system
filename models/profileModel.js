import pool from "../config/db.js";
import { generateCacheKey, getCache, setCache, normalizeFilters, invalidateQueryCache } from "../services/cacheService.js";

// Select only needed columns (not *)
const PROFILE_COLUMNS = [
  "id",
  "name",
  "gender",
  "gender_probability",
  "age",
  "age_group",
  "country_id",
  "country_name",
  "country_probability",
  "created_at",
];

export async function getAll(filters) {
  // Normalize filters for consistent caching
  const normalized = normalizeFilters(filters);

  let {
    gender,
    age_group,
    country_id,
    min_age,
    max_age,
    min_gender_probability,
    min_country_probability,
    sort_by = "created_at",
    order = "asc",
    page = 1,
    limit = 10,
    raw,
  } = normalized;

  page = parseInt(page);
  limit = Math.min(parseInt(limit), 50);

  // Generate cache key from normalized filters
  const cacheKey = generateCacheKey(normalized);

  // Check cache first
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const values = [];
  let query = `SELECT ${PROFILE_COLUMNS.join(", ")}, COUNT(*) OVER() AS total_count FROM profiles WHERE 1=1`;

  // NAME SEARCH
  if (raw) {
    values.push(`%${raw}%`);
    query += ` AND name ILIKE $${values.length}`;
  }

  if (gender) {
    values.push(gender);
    query += ` AND gender = $${values.length}`;
  }

  if (age_group) {
    values.push(age_group);
    query += ` AND age_group = $${values.length}`;
  }

  if (Array.isArray(country_id)) {
    values.push(country_id);
    query += ` AND country_id = ANY($${values.length})`;
  } else if (country_id) {
    values.push(country_id);
    query += ` AND country_id = $${values.length}`;
  }

  if (min_age) {
    values.push(min_age);
    query += ` AND age >= $${values.length}`;
  }

  if (max_age) {
    values.push(max_age);
    query += ` AND age <= $${values.length}`;
  }

  if (min_gender_probability) {
    values.push(min_gender_probability);
    query += ` AND gender_probability >= $${values.length}`;
  }

  if (min_country_probability) {
    values.push(min_country_probability);
    query += ` AND country_probability >= $${values.length}`;
  }

  const allowedSort = ["age", "created_at", "gender_probability"];
  const allowedOrder = ["asc", "desc"];

  if (!allowedSort.includes(sort_by) || !allowedOrder.includes(order)) {
    throw new Error("Invalid query parameters");
  }

  query += ` ORDER BY ${sort_by} ${order}`;

  const offset = (page - 1) * limit;
  values.push(limit);
  query += ` LIMIT $${values.length}`;

  values.push(offset);
  query += ` OFFSET $${values.length}`;

  const data = await pool.query(query, values);
  const total = data.rows.length > 0 ? parseInt(data.rows[0].total_count, 10) : 0;

  const result = {
    data: data.rows.map(({ total_count, ...row }) => row),
    total,
    page,
    limit,
  };

  // Cache result (5 minutes)
  setCache(cacheKey, result, 300);

  return result;
}

export async function findByName(name) {
  const res = await pool.query(
    `SELECT ${PROFILE_COLUMNS.join(", ")} FROM profiles WHERE name=$1`,
    [name]
  );
  return res.rows[0];
}

export async function findById(id) {
  const res = await pool.query(
    `SELECT ${PROFILE_COLUMNS.join(", ")} FROM profiles WHERE id=$1`,
    [id]
  );
  return res.rows[0];
}

export async function create(profile) {
  await pool.query(
    `INSERT INTO profiles 
    (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      profile.id,
      profile.name,
      profile.gender,
      profile.gender_probability,
      profile.age,
      profile.age_group,
      profile.country_id,
      profile.country_name,
      profile.country_probability,
      profile.created_at,
      profile.created_by,
    ]
  );

  // Invalidate query cache when new profile is created
  invalidateQueryCache();
}

export async function deleteById(id) {
  const res = await pool.query(
    "DELETE FROM profiles WHERE id=$1",
    [id]
  );

  // Invalidate query cache when profile is deleted
  if (res.rowCount > 0) {
    invalidateQueryCache();
  }

  return res.rowCount;
}