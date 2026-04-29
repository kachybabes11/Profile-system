export function parseQuery(q) {
  if (!q) return null;

  q = q.toLowerCase();

  const filters = {};

  // keep raw query for name search
  const raw = q.trim();

  // GENDER
  if (q.match(/\b(male|males|man|men|boy|boys|guy|guys)\b/)) {
    filters.gender = "male";
  }

  if (q.match(/\b(female|females|woman|women|girl|girls)\b/)) {
    filters.gender = "female";
  }

  // AGE GROUP
  if (q.includes("young")) {
    filters.min_age = 16;
    filters.max_age = 24;
  }

  if (q.includes("child")) filters.age_group = "child";
  if (q.includes("teenager")) filters.age_group = "teenager";
  if (q.includes("adult")) filters.age_group = "adult";
  if (q.includes("senior")) filters.age_group = "senior";

  // NUMERIC AGE RULES
  const between = q.match(/between (\d+) and (\d+)/);
  if (between) {
    filters.min_age = +between[1];
    filters.max_age = +between[2];
  }

  const above = q.match(/above (\d+)/);
  if (above) filters.min_age = +above[1];

  const below = q.match(/below (\d+)/);
  if (below) filters.max_age = +below[1];

  const under = q.match(/under (\d+)/);
  if (under) filters.max_age = +under[1];

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

  for (let key in countries) {
    if (q.includes(key)) {
      filters.country_id = countries[key];
      foundCountry = true;
      break;
    }
  }

  // CONTINENT fallback
  if (!foundCountry) {
    const continentMap = {
      africa: ["NG", "KE", "GH", "EG", "ZA", "UG", "TZ"],
      europe: ["GB", "FR", "DE", "IT", "ES"],
      asia: ["CN", "IN", "JP", "PK"],
      america: ["US", "CA", "BR", "MX"],
    };

    for (let continent in continentMap) {
      if (q.includes(continent)) {
        filters.country_id = continentMap[continent];
        break;
      }
    }
  }

  return {
    filters,
    raw // IMPORTANT FOR NAME SEARCH
  };
}