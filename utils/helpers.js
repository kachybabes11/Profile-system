export function getAgeGroup(age) {
  if (age <= 12) return "child";
  if (age <= 19) return "teenager";
  if (age <= 59) return "adult";
  return "senior";
}

export function pickBestCountry(countries) {
  if (!countries.length) return null;

  return countries.reduce((max, curr) =>
    curr.probability > max.probability ? curr : max
  );
}