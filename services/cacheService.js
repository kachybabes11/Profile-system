import NodeCache from "node-cache";

// In-memory cache with 5-minute TTL (300 seconds)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Normalize filters to canonical form
 * Ensures equivalent filters produce identical cache keys
 * Examples:
 *   "young" (16-24) → min_age: 16, max_age: 24
 *   "women aged 20-45" → gender: "female", min_age: 20, max_age: 45
 */
export function normalizeFilters(filters) {
  if (!filters || typeof filters !== "object") {
    return {};
  }

  const normalized = {};

  // Normalize gender - always lowercase, ensure valid values
  if (filters.gender) {
    const genderVal = String(filters.gender).toLowerCase().trim();
    if (["male", "female"].includes(genderVal)) {
      normalized.gender = genderVal;
    }
  }

  // Normalize age group
  if (filters.age_group) {
    const ageGroup = String(filters.age_group).toLowerCase().trim();
    if (["child", "teenager", "adult", "senior"].includes(ageGroup)) {
      normalized.age_group = ageGroup;
    }
  }

  // Normalize numeric ages
  if (filters.min_age !== undefined) {
    const minAge = parseInt(filters.min_age, 10);
    if (!isNaN(minAge) && minAge >= 0) {
      normalized.min_age = minAge;
    }
  }

  if (filters.max_age !== undefined) {
    const maxAge = parseInt(filters.max_age, 10);
    if (!isNaN(maxAge) && maxAge >= 0) {
      normalized.max_age = maxAge;
    }
  }

  // Normalize country_id (handle both single and array)
  if (filters.country_id) {
    if (Array.isArray(filters.country_id)) {
      // Sort array for consistent ordering
      normalized.country_id = filters.country_id
        .map(c => String(c).toUpperCase().trim())
        .filter(c => c.length > 0)
        .sort();
    } else {
      const countryId = String(filters.country_id).toUpperCase().trim();
      if (countryId.length > 0) {
        normalized.country_id = countryId;
      }
    }
  }

  // Normalize probability thresholds
  if (filters.min_gender_probability !== undefined) {
    const minProb = parseFloat(filters.min_gender_probability);
    if (!isNaN(minProb) && minProb >= 0 && minProb <= 1) {
      normalized.min_gender_probability = Math.round(minProb * 1000) / 1000; // 3 decimals
    }
  }

  if (filters.min_country_probability !== undefined) {
    const minProb = parseFloat(filters.min_country_probability);
    if (!isNaN(minProb) && minProb >= 0 && minProb <= 1) {
      normalized.min_country_probability = Math.round(minProb * 1000) / 1000;
    }
  }

  // Normalize sorting (only if valid columns)
  if (filters.sort_by) {
    const sortBy = String(filters.sort_by).toLowerCase().trim();
    if (["age", "created_at", "gender_probability"].includes(sortBy)) {
      normalized.sort_by = sortBy;
    } else {
      normalized.sort_by = "created_at"; // default
    }
  } else {
    normalized.sort_by = "created_at";
  }

  if (filters.order) {
    const order = String(filters.order).toLowerCase().trim();
    if (["asc", "desc"].includes(order)) {
      normalized.order = order;
    } else {
      normalized.order = "asc"; // default
    }
  } else {
    normalized.order = "asc";
  }

  // Normalize pagination (always include, even if not provided)
  let page = parseInt(filters.page, 10);
  if (isNaN(page) || page < 1) page = 1;
  normalized.page = page;

  let limit = parseInt(filters.limit, 10);
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 50) limit = 50; // max limit
  normalized.limit = limit;

  // Normalize raw search string (for name search)
  if (filters.raw) {
    const raw = String(filters.raw).toLowerCase().trim();
    if (raw.length > 0) {
      normalized.raw = raw;
    }
  }

  return normalized;
}

/**
 * Generate deterministic cache key from normalized filters
 * Same input always produces same key
 * Example: "q:gender:female|min_age:20|max_age:45|country:NG|page:1|limit:10"
 */
export function generateCacheKey(filters, prefix = "q") {
  const normalized = normalizeFilters(filters);

  // Create sorted key-value pairs
  const parts = [];

  // Always include these in order for consistency
  const keyOrder = [
    "gender",
    "age_group",
    "min_age",
    "max_age",
    "country_id",
    "min_gender_probability",
    "min_country_probability",
    "raw",
    "sort_by",
    "order",
    "page",
    "limit",
  ];

  for (const key of keyOrder) {
    if (normalized[key] !== undefined) {
      const val = normalized[key];
      if (Array.isArray(val)) {
        parts.push(`${key}:${val.join(",")}`);
      } else {
        parts.push(`${key}:${val}`);
      }
    }
  }

  return `${prefix}:${parts.join("|")}`;
}

/**
 * Get cached result
 */
export function getCache(key) {
  return cache.get(key);
}

/**
 * Set cache with automatic TTL (5 minutes by default)
 */
export function setCache(key, value, ttl = 300) {
  cache.set(key, value, ttl);
}

/**
 * Delete specific cache entry
 */
export function deleteCache(key) {
  cache.del(key);
}

/**
 * Clear all cache (for when data is modified)
 */
export function clearAllCache() {
  cache.flushAll();
}

/**
 * Get cache stats
 */
export function getCacheStats() {
  return cache.getStats();
}

/**
 * Invalidate query cache when data changes
 * Flushes all query cache (prefix "q:")
 */
export function invalidateQueryCache() {
  const keys = cache.keys();
  keys.forEach(key => {
    if (key.startsWith("q:")) {
      cache.del(key);
    }
  });
}

export default {
  normalizeFilters,
  generateCacheKey,
  getCache,
  setCache,
  deleteCache,
  clearAllCache,
  getCacheStats,
  invalidateQueryCache,
};
