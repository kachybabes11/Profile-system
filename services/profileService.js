import * as profileModel from "../models/profileModel.js";
import { fetchExternalData } from "./externalApiService.js";
import { getAgeGroup, pickBestCountry } from "../utils/helpers.js";
import { parseQuery } from "../utils/queryParser.js";
import { invalidateQueryCache } from "./cacheService.js";
import { uuidv7 } from "uuidv7";

/**
 * Get profiles with filtering, sorting, and pagination
 */
export async function getProfilesData(filters) {
  return await profileModel.getAll(filters);
}

/**
 * Search profiles using natural language
 */
export async function searchProfilesData(query, filters) {
  const parsed = parseQuery(query);
  if (!parsed) {
    throw new Error("Unable to interpret query");
  }

  const { filters: parsedFilters, raw } = parsed;
  return await profileModel.getAll({
    ...parsedFilters,
    raw,
    ...filters,
  });
}

/**
 * Create a new profile
 */
export async function createProfileData(name, userId) {
  if (!name) {
    throw new Error("Missing or empty name");
  }

  if (typeof name !== "string") {
    throw new Error("Invalid type");
  }

  name = name.trim().toLowerCase();

  const existing = await profileModel.findByName(name);
  if (existing) {
    throw new Error("Profile already exists");
  }

  const { gender, age, nationality } = await fetchExternalData(name);

  if (!gender.gender || gender.count === 0) {
    throw new Error("Genderize returned an invalid response");
  }

  if (!age.age) {
    throw new Error("Agify returned an invalid response");
  }

  if (!nationality.country || nationality.country.length === 0) {
    throw new Error("Nationalize returned an invalid response");
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
    created_by: userId,
  };

  await profileModel.create(profile);
  invalidateQueryCache();

  return profile;
}

/**
 * Get single profile by ID
 */
export async function getProfileByIdData(id) {
  const profile = await profileModel.findById(id);
  if (!profile) {
    throw new Error("Profile not found");
  }
  return profile;
}

/**
 * Delete profile by ID
 */
export async function deleteProfileByIdData(id) {
  const deleted = await profileModel.deleteById(id);
  if (!deleted) {
    throw new Error("Profile not found");
  }
  invalidateQueryCache();
  return { id };
}

/**
 * Export profiles as CSV
 */
export async function exportProfilesAsCSVData(filters) {
  return await profileModel.exportProfilesAsCSV(filters);
}

/**
 * Process CSV upload
 */
export async function processCSVUploadData(fileStream) {
  return await profileModel.processCSVStream(fileStream);
}

/**
 * Validate CSV headers
 */
export async function validateCSVHeadersData(headers) {
  return await profileModel.validateCSVHeaders(headers);
}