#!/usr/bin/env node

/**
 * Database Migration Script
 * Creates users table and updates profiles table
 * Run: node scripts/migrate.js
 */

import pool from "../config/db.js";
import dotenv from "dotenv";

dotenv.config();

const migrations = [
  // Create users table
  {
    name: "create_users_table",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        github_id INTEGER UNIQUE NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255),
        avatar_url VARCHAR(500),
        role VARCHAR(50) DEFAULT 'analyst' CHECK (role IN ('admin', 'analyst')),
        is_active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `
  },
  // Add user_id to profiles table
  {
    name: "add_user_id_to_profiles",
    sql: `
      ALTER TABLE profiles 
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
      
      CREATE INDEX IF NOT EXISTS idx_profiles_created_by ON profiles(created_by);
    `
  },
  // Create refresh_tokens table for token management
  {
    name: "create_refresh_tokens_table",
    sql: `
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(500) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_revoked BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
    `
  }
];

async function runMigrations() {
  try {
    console.log("Starting database migrations...");

    for (const migration of migrations) {
      try {
        console.log(`\nRunning: ${migration.name}`);
        await pool.query(migration.sql);
        console.log(`✓ ${migration.name} completed`);
      } catch (err) {
        console.error(`✗ ${migration.name} failed:`, err.message);
      }
    }

    console.log("\n✓ All migrations completed");
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

runMigrations();
