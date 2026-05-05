#!/usr/bin/env node

/**
 * Test Role Assignment Logic
 * Run: node test-roles.js
 */

import pool from "./config/db.js";

async function testRoleAssignment() {
  console.log("Testing role assignment logic...\n");

  try {
    // Clear existing users for testing
    await pool.query("DELETE FROM users");

    // Mock GitHub user data
    const mockUsers = [
      { id: 1, login: "admin1", email: "admin1@test.com", avatar_url: "https://example.com/avatar1.jpg" },
      { id: 2, login: "admin2", email: "admin2@test.com", avatar_url: "https://example.com/avatar2.jpg" },
      { id: 3, login: "admin3", email: "admin3@test.com", avatar_url: "https://example.com/avatar3.jpg" },
      { id: 4, login: "analyst1", email: "analyst1@test.com", avatar_url: "https://example.com/avatar4.jpg" },
      { id: 5, login: "analyst2", email: "analyst2@test.com", avatar_url: "https://example.com/avatar5.jpg" },
    ];

    const results = [];

    for (const user of mockUsers) {
      // Check how many users exist
      const countQuery = "SELECT COUNT(*) as user_count FROM users";
      const countResult = await pool.query(countQuery);
      const userCount = parseInt(countResult.rows[0].user_count);

      // First 3 users are admin, rest are analyst
      const role = userCount < 3 ? 'admin' : 'analyst';

      const query = `
        INSERT INTO users (github_id, username, email, avatar_url, role, last_login_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (github_id) DO UPDATE SET
          username = EXCLUDED.username,
          email = EXCLUDED.email,
          avatar_url = EXCLUDED.avatar_url,
          last_login_at = NOW()
        RETURNING id, username, email, avatar_url, role, is_active;
      `;

      const result = await pool.query(query, [user.id, user.login, user.email, user.avatar_url, role]);
      results.push(result.rows[0]);

      console.log(`User ${user.login}: Role assigned = ${result.rows[0].role} (user count: ${userCount})`);
    }

    console.log("\nFinal Results:");
    results.forEach((user, index) => {
      const expectedRole = index < 3 ? 'admin' : 'analyst';
      const status = user.role === expectedRole ? '✅' : '❌';
      console.log(`${status} ${user.username}: ${user.role} (expected: ${expectedRole})`);
    });

    // Verify final state
    const finalQuery = "SELECT username, role FROM users ORDER BY id";
    const finalResult = await pool.query(finalQuery);

    console.log("\nDatabase state:");
    finalResult.rows.forEach(row => {
      console.log(`- ${row.username}: ${row.role}`);
    });

  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await pool.end();
  }
}

testRoleAssignment();