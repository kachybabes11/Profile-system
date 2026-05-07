import pool from "../config/db.js";
import { uuidv7 } from "uuidv7";

/**
 * Create or update user from GitHub data
 */
export async function createOrUpdateUser(githubData) {
  const { id: githubId, login: username, email, avatar_url } = githubData;

  // Check how many users exist to determine role
  const countQuery = "SELECT COUNT(*) as user_count FROM users";
  const countResult = await pool.query(countQuery);
  const userCount = parseInt(countResult.rows[0].user_count);

  // First 3 users are admin, rest are analyst
  const role = userCount < 3 ? 'admin' : 'analyst';

  const userId = uuidv7();

  const query = `
    INSERT INTO users (id, github_id, username, email, avatar_url, role, last_login_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (github_id) DO UPDATE SET
      username = EXCLUDED.username,
      email = EXCLUDED.email,
      avatar_url = EXCLUDED.avatar_url,
      last_login_at = NOW()
    RETURNING id, username, email, avatar_url, role, is_active;
  `;

  const result = await pool.query(query, [userId, githubId, username, email, avatar_url, role]);
  return result.rows[0];
}

/**
 * Find user by GitHub ID
 */
export async function findByGithubId(githubId) {
  const query = "SELECT id, github_id, username, email, avatar_url, role, is_active FROM users WHERE github_id = $1";
  const result = await pool.query(query, [githubId]);
  return result.rows[0];
}

/**
 * Find user by username
 */
export async function findByUsername(username) {
  const query = "SELECT id, github_id, username, email, avatar_url, role, is_active FROM users WHERE username = $1";
  const result = await pool.query(query, [username]);
  return result.rows[0];
}

/**
 * Find user by ID
 */
export async function findById(userId) {
  const query = "SELECT id, github_id, username, email, avatar_url, role, is_active FROM users WHERE id = $1";
  const result = await pool.query(query, [userId]);
  return result.rows[0];
}

/**
 * Get user role
 */
export async function getUserRole(userId) {
  const query = "SELECT role FROM users WHERE id = $1";
  const result = await pool.query(query, [userId]);
  return result.rows[0]?.role;
}

/**
 * Check if user is admin
 */
export async function isAdmin(userId) {
  const role = await getUserRole(userId);
  return role === "admin";
}

/**
 * Update last login
 */
export async function updateLastLogin(userId) {
  const query = "UPDATE users SET last_login_at = NOW() WHERE id = $1";
  await pool.query(query, [userId]);
}

/**
 * Deactivate user
 */
export async function deactivateUser(userId) {
  const query = "UPDATE users SET is_active = false WHERE id = $1";
  await pool.query(query, [userId]);
}

/**
 * Store refresh token
 */
export async function storeRefreshToken(userId, tokenHash, expiresAt) {
  const query = `
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
    VALUES (gen_random_uuid(), $1, $2, $3)
    RETURNING id;
  `;
  const result = await pool.query(query, [userId, tokenHash, expiresAt]);
  return result.rows[0];
}

/**
 * Verify refresh token exists and is not revoked
 */
export async function verifyRefreshToken(tokenHash) {
  const query = `
    SELECT id, user_id, expires_at, is_revoked
    FROM refresh_tokens
    WHERE token_hash = $1
    AND is_revoked = false
    AND expires_at > NOW();
  `;
  const result = await pool.query(query, [tokenHash]);
  return result.rows[0];
}

/**
 * Revoke refresh token
 */
export async function revokeRefreshToken(tokenHash) {
  const query = "UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1";
  await pool.query(query, [tokenHash]);
}

/**
 * Revoke all user tokens
 */
export async function revokeAllUserTokens(userId) {
  const query = "UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1";
  await pool.query(query, [userId]);
}

export default {
  createOrUpdateUser,
  findByGithubId,
  findByUsername,
  findById,
  getUserRole,
  isAdmin,
  updateLastLogin,
  deactivateUser,
  storeRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
};
