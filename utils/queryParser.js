const STOPWORDS = new Set([
  "and","or","the","a","an","in","on","at","of","for","to","with","by","from",
  "living","between","above","below","under","age","ages","aged","years","year",
  "old"
]);

function canonicalizeRaw(rawQuery, usedTerms) {
  const tokens = rawQuery
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map(t => t.trim())
    .filter(t => t && !STOPWORDS.has(t) && !usedTerms.has(t));

  return tokens.length ? [...new Set(tokens)].sort().join(" ") : undefined;
}

export function parseQuery(q) {
  const rawQuery = String(q || "").toLowerCase();
  const filters = {};
  const usedTerms = new Set();

  const markTerms = (phrase) => {
    phrase
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .forEach(t => usedTerms.add(t));
  };

  // GENDER
  if (/\b(male|males|man|men|boy|boys|guy|guys)\b/.test(rawQuery)) {
    filters.gender = "male";
    markTerms("male males man men boy boys guy guys");
  }

  if (/\b(female|females|woman|women|girl|girls)\b/.test(rawQuery)) {
    filters.gender = "female";
    markTerms("female females woman women girl girls");
  }

  // AGE GROUP
  if (rawQuery.includes("young")) {
    filters.min_age = 16;
    filters.max_age = 24;
    markTerms("young");
  }

  if (rawQuery.includes("child")) {
    filters.age_group = "child";
    markTerms("child");
  }
  if (rawQuery.includes("teenager")) {
    filters.age_group = "teenager";
    markTerms("teenager");
  }
  if (rawQuery.includes("adult")) {
    filters.age_group = "adult";
    markTerms("adult");
  }
  if (rawQuery.includes("senior")) {
    filters.age_group = "senior";
    markTerms("senior");
  }

  // NUMERIC AGE RULES (FIXED)
  const between = rawQuery.match(/between (\d+) and (\d+)/);
  if (between) {
    filters.min_age = Number(between[1]);
    filters.max_age = Number(between[2]);
  }

  const above = rawQuery.match(/above (\d+)/);
  if (above) filters.min_age = Number(above[1]);

  const below = rawQuery.match(/below (\d+)/);
  if (below) filters.max_age = Number(below[1]);

  const under = rawQuery.match(/under (\d+)/);
  if (under) filters.max_age = Number(under[1]);

  // COUNTRY
  const countries = {
    nigeria: "NG",
    kenya: "KE",
    ghana: "GH",
    egypt: "EG",
    angola: "AO",
    uk: "GB",
    "united kingdom": "GB",
    usa: "US",
    "united states": "US",
    america: "US",
  };

  for (const key of Object.keys(countries)) {
    if (rawQuery.includes(key)) {
      filters.country_id = countries[key];
      markTerms(key);
      break;
    }
  }

  const continentMap = {
    africa: ["NG","KE","GH","EG","ZA","UG","TZ"],
    europe: ["GB","FR","DE","IT","ES"],
    asia: ["CN","IN","JP","PK"],
    america: ["US","CA","BR","MX"],
  };

  for (const continent of Object.keys(continentMap)) {
    if (rawQuery.includes(continent)) {
      filters.country_id = continentMap[continent];
      markTerms(continent);
      break;
    }
  }

  const raw = canonicalizeRaw(rawQuery, usedTerms);

  return { filters, raw };
}