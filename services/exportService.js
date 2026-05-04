import pool from "../config/db.js";

/**
 * Export profiles to CSV format
 */
export async function exportProfilesAsCSV(filters = {}) {
  try {
    const { gender, age_group, country_id, min_age, max_age, sort_by = "created_at", order = "asc" } = filters;

    const values = [];
    let query = `SELECT 
      id, name, gender, gender_probability, age, age_group, 
      country_id, country_name, country_probability, created_at
      FROM profiles WHERE 1=1`;

    if (gender) {
      values.push(gender);
      query += ` AND gender = $${values.length}`;
    }

    if (age_group) {
      values.push(age_group);
      query += ` AND age_group = $${values.length}`;
    }

    if (country_id) {
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

    const allowedSort = ["age", "created_at", "gender_probability", "name"];
    const allowedOrder = ["asc", "desc"];
    const validSortBy = allowedSort.includes(sort_by) ? sort_by : "created_at";
    const validOrder = allowedOrder.includes(order) ? order : "asc";

    query += ` ORDER BY ${validSortBy} ${validOrder}`;

    const result = await pool.query(query, values);
    const profiles = result.rows;

    // CSV headers
    const headers = ["id", "name", "gender", "gender_probability", "age", "age_group", "country_id", "country_name", "country_probability", "created_at"];

    // CSV content
    const csv =
      headers.join(",") +
      "\n" +
      profiles
        .map((row) => {
          return headers
            .map((header) => {
              const value = row[header];
              if (value === null || value === undefined) {
                return "";
              }
              // Escape quotes and wrap in quotes if contains comma
              const escaped = String(value).replace(/"/g, '""');
              return escaped.includes(",") ? `"${escaped}"` : escaped;
            })
            .join(",");
        })
        .join("\n");

    return csv;
  } catch (err) {
    console.error("CSV export error:", err);
    throw err;
  }
}

export default { exportProfilesAsCSV };
