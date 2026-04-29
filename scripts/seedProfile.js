import pg from "pg";
import fs from "fs";
import { uuidv7 } from "uuidv7";
import dotenv from "dotenv";
dotenv.config();

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

await db.connect();

const data = JSON.parse(
  fs.readFileSync("./data/seed_profiles.json", "utf-8")
);

for (let profile of data.profiles) {
  await db.query(
    `INSERT INTO profiles 
    (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (name) DO NOTHING`,
    [
      uuidv7(),
      profile.name,
      profile.gender,
      profile.gender_probability,
      profile.age,
      profile.age_group,
      profile.country_id,
      profile.country_name,
      profile.country_probability,
      new Date().toISOString(),
    ]
  );
}

console.log("Seeding complete");
await db.end();