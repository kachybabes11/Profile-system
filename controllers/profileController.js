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
import pool from "../config/db.js";


// GET ALL PROFILES 
export async function getProfiles(req, res) {
  try {
    const result = await getAll(req.query);

    res.json({
      status: "success",
      page: result.page,
      limit: result.limit,
      total: result.total,
      data: result.data,
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

    res.json({
      status: "success",
      page: result.page,
      limit: result.limit,
      total: result.total,
      data: result.data,
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
    const result = await pool.query("SELECT * FROM profiles");

    const profiles = result.rows;

    if (!profiles.length) {
      return res.status(404).json({
        status: "error",
        message: "No profiles found"
      });
    }

    // CSV HEADER
    const header = [
      "id",
      "name",
      "gender",
      "age",
      "country"
    ].join(",");

    // CSV ROWS
    const rows = profiles
      .map(p =>
        [
          p.id,
          p.name,
          p.gender,
          p.age,
          p.country_name
        ].join(",")
      )
      .join("\n");

    const csv = `${header}\n${rows}`;

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