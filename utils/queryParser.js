const STOPWORDS = new Set([
  "and",
  "or",
  "the",
  "a",
  "an",
  "in",
  "on",
  "at",
  "of",
  "for",
  "to",
  "with",
  "by",
  "from",
  "living",
  "between",
  "above",
  "below",
  "under",
  "age",
  "ages",
  "aged",
  "years",
  "year",
  "old",
]);

function canonicalizeRaw(rawQuery, usedTerms) {
  const tokens = rawQuery
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((token) => token.trim())

  if (tokens.length === 0) {
    return undefined;
  }

  return [...new Set(tokens)].sort().join(" ");
}

export function parseQuery(q) {

  const rawQuery = String(q).toLowerCase();
  const filters = {};
  const usedTerms = new Set();

  const markTerms = (phrase) => {
    phrase
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((token) => token.length > 0)
      .forEach((token) => usedTerms.add(token));
  };

  // GENDER
  if (rawQuery.match(/(male|males|man|men|boy|boys|guy|guys)/)) {
    filters.gender = "male";
    markTerms("male males man men boy boys guy guys");
  }

  if (rawQuery.match(/(female|females|woman|women|girl|girls)/)) {
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

  // NUMERIC AGE RULES
  const between = rawQuery.match(/between (d+) and (d+)/);
  if (between) {
    filters.min_age = +between[1];
    filters.max_age = +between[2];
    markTerms(between[0]);
  }

  const above = rawQuery.match(/above (d+)/);
  if (above) {
    filters.min_age = +above[1];
    markTerms(above[0]);
  }

  const below = rawQuery.match(/below (d+)/);
  if (below) {
    filters.max_age = +below[1];
    markTerms(below[0]);
  }

  const under = rawQuery.match(/under (d+)/);
  if (under) {
    filters.max_age = +under[1];
    markTerms(under[0]);
  }

  markTerms("age ages aged years year old");

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

  let foundCountry = false;

  for (const key of Object.keys(countries)) {
    if (rawQuery.includes(key)) {
      filters.country_id = countries[key];
      markTerms(key);
      foundCountry = true;
      break;
    }
  }

  // CONTINENT fallback
    const continentMap = {
      africa: ["NG", "KE", "GH", "EG", "ZA", "UG", "TZ"],
      europe: ["GB", "FR", "DE", "IT", "ES"],
      asia: ["CN", "IN", "JP", "PK"],
      america: ["US", "CA", "BR", "MX"],
    };

    for (const continent of Object.keys(continentMap)) {
      if (rawQuery.includes(continent)) {
        filters.country_id = continentMap[continent];
        markTerms(continent);
        break;
      }
    }

  const raw = canonicalizeRaw(rawQuery, usedTerms);

  return {
    filters,
    raw,
  };
}
