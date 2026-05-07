import fs from "fs";
import readline from "readline";
import {
  getProfilesData,
  searchProfilesData,
  createProfileData,
  getProfileByIdData,
  deleteProfileByIdData,
  exportProfilesAsCSVData,
  processCSVUploadData,
  validateCSVHeadersData,
} from "../services/profileService.js";
import { parseQuery } from "../utils/queryParser.js";
import { invalidateQueryCache } from "../services/cacheService.js";


// GET ALL PROFILES 
export async function getProfiles(req, res) {
  try {
    const result = await getProfilesData(req.query);

    const totalPages = Math.ceil(result.total / result.limit);
    const nextPage = result.page < totalPages ? result.page + 1 : null;
    const prevPage = result.page > 1 ? result.page - 1 : null;

    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;

    res.json({
      status: "success",
      page: result.page,
      limit: result.limit,
      total: result.total,
      total_pages: totalPages,
      links: {
        self: `${baseUrl}?${new URLSearchParams(req.query).toString()}`,
        next: nextPage ? `${baseUrl}?${new URLSearchParams({ ...req.query, page: nextPage }).toString()}` : null,
        prev: prevPage ? `${baseUrl}?${new URLSearchParams({ ...req.query, page: prevPage }).toString()}` : null,
      },
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
    const result = await searchProfilesData(req.query.q, req.query);

    const totalPages = Math.ceil(result.total / result.limit);
    const nextPage = result.page < totalPages ? result.page + 1 : null;
    const prevPage = result.page > 1 ? result.page - 1 : null;

    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;

    res.json({
      status: "success",
      page: result.page,
      limit: result.limit,
      total: result.total,
      total_pages: totalPages,
      data: result.data,
      links: {
        self: `${baseUrl}?${new URLSearchParams(req.query).toString()}`,
        next: nextPage ? `${baseUrl}?${new URLSearchParams({ ...req.query, page: nextPage }).toString()}` : null,
        prev: prevPage ? `${baseUrl}?${new URLSearchParams({ ...req.query, page: prevPage }).toString()}` : null,
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
    const { name } = req.body;
    const profile = await createProfileData(name, req.user.userId);

    res.status(201).json({
      status: "success",
      data: profile
    });
  } catch (err) {
    res.status(400).json({
      status: "error",
      message: err.message,
    });
  }
}

// GET SINGLE PROFILE
export async function getSingleProfile(req, res) {
  try {
    const profile = await getProfileByIdData(req.params.id);

    res.json({
      status: "success",
      data: profile,
    });
  } catch (err) {
    res.status(404).json({
      status: "error",
      message: err.message,
    });
  }
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

    await deleteProfileByIdData(id);

    res.status(200).json({
      status: "success",
      message: "Profile deleted successfully",
      data: { id }
    });

  } catch (err) {
    res.status(404).json({
      status: "error",
      message: err.message
    });
  }
}


export async function exportProfiles(req, res) {
  try {
    const csv = await exportProfilesAsCSVData(req.query);

    res.status(200).json({
      status: "success",
      data: csv
    });

  } catch (err) {
    res.status(500).json({
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
    const validation = await validateCSVHeadersData(headers);

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

    res.status(400).json({
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
    const stats = await processCSVUploadData(fileStream);

    // Clean up uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error deleting temp file:", err);
    });

    return res.status(201).json({
      status: "success",
      total_rows: stats.total_rows,
      inserted: stats.inserted,
      skipped: stats.skipped,
      reasons: stats.reasons,
    });

  } catch (err) {
    // Clean up file on error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting temp file on error:", unlinkErr);
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to process CSV upload",
      details: err.message,
    });
  }
}