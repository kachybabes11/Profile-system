import pool from "../config/db.js";

export async function getAll(filters) {
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
    raw, // 🔥 ADD THIS (from search query)
  } = filters;

  page = parseInt(page);
  limit = Math.min(parseInt(limit), 50);

  const values = [];
  let query = "SELECT * FROM profiles WHERE 1=1";

  // 🔥 NAME SEARCH (IMPORTANT FIX)
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

  // sorting validation
  const allowedSort = ["age", "created_at", "gender_probability"];
  const allowedOrder = ["asc", "desc"];

  if (!allowedSort.includes(sort_by) || !allowedOrder.includes(order)) {
    throw new Error("Invalid query parameters");
  }

  query += ` ORDER BY ${sort_by} ${order}`;

  // pagination
  const offset = (page - 1) * limit;
  values.push(limit);
  query += ` LIMIT $${values.length}`;

  values.push(offset);
  query += ` OFFSET $${values.length}`;

  const data = await pool.query(query, values);

  const totalRes = await pool.query("SELECT COUNT(*) FROM profiles");

  return {
    data: data.rows,
    total: parseInt(totalRes.rows[0].count),
    page,
    limit,
  };
}

export async function findByName(name) {
  const res = await pool.query(
    "SELECT * FROM profiles WHERE name=$1",
    [name]
  );
  return res.rows[0];
}

export async function findById(id) {
  const res = await pool.query(
    "SELECT * FROM profiles WHERE id=$1",
    [id]
  );
  return res.rows[0];
}

export async function create(profile) {
  await pool.query(
    `INSERT INTO profiles 
    (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
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
    ]
  );
}

export async function deleteById(id) {
  const res = await pool.query(
    "DELETE FROM profiles WHERE id=$1",
    [id]
  );
  return res.rowCount;
}