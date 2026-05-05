import axios from "axios";
import * as userModel from "../models/userModel.js";
import pool from "../config/db.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  generateCodeVerifier,
  generateCodeChallenge,
} from "./tokenService.js";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URL = process.env.GITHUB_REDIRECT_URL || "http://localhost:3000/auth/github/callback";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
const CLI_REDIRECT_PATH = "/auth/cli/callback";
const cliPkceStateStore = new Map();

export function getPkceCodeVerifierFromState(state) {
  if (!state) {
    return null;
  }
  const verifier = cliPkceStateStore.get(state);
  cliPkceStateStore.delete(state);
  return verifier || null;
}

/**
 * Validate OAuth configuration at startup
 */
export function validateOAuthConfig() {
  const errors = [];
  const warnings = [];

  if (!GITHUB_CLIENT_ID) {
    errors.push("GITHUB_CLIENT_ID environment variable is not set");
  }
  if (!GITHUB_CLIENT_SECRET) {
    errors.push("GITHUB_CLIENT_SECRET environment variable is not set");
  }
  if (!process.env.GITHUB_REDIRECT_URL) {
    warnings.push(
      `GITHUB_REDIRECT_URL not set. Using default: ${GITHUB_REDIRECT_URL}. ` +
      "This must match your GitHub OAuth app settings exactly (production vs localhost)."
    );
  }
  if (!process.env.JWT_SECRET) {
    warnings.push(
      "JWT_SECRET not set. Using insecure default. Set JWT_SECRET in production."
    );
  }
  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL environment variable is not set");
  }

  if (errors.length > 0) {
    console.error("❌ OAuth Configuration Errors:");
    errors.forEach(e => console.error(`   - ${e}`));
    console.error("\n   Fix these before OAuth will work.");
  }

  if (warnings.length > 0) {
    console.warn("⚠️  OAuth Configuration Warnings:");
    warnings.forEach(w => console.warn(`   - ${w}`));
  }

  return errors.length === 0;
}

/**
 * Validate database connection is working
 */
export async function validateDatabaseConnection() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Database connection verified");
    return true;
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    return false;
  }
}

function resolveRedirectUri(callbackUrl) {
  if (callbackUrl?.startsWith("http://") || callbackUrl?.startsWith("https://")) {
    return callbackUrl;
  }

  if (callbackUrl === "/auth/github/callback") {
    return GITHUB_REDIRECT_URL;
  }

  return `${BACKEND_URL}${callbackUrl}`;
}

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.warn("⚠️  GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.");
}

/**
 * Get GitHub OAuth authorization URL (for browser)
 */
export function getGitHubAuthorizationUrl(callbackUrl = "/auth/github/callback") {
  const scopes = ["read:user", "user:email"];
  const redirectUri = resolveRedirectUri(callbackUrl);

  return `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scopes.join(
    ","
  )}&allow_signup=false`;
}

/**
 * Get GitHub authorization URL for CLI with PKCE
 */
export function getGitHubAuthorizationUrlWithPKCE(codeVerifier) {
  if (!codeVerifier) {
    throw new Error("codeVerifier is required for CLI PKCE flow");
  }

  const codeChallenge = generateCodeChallenge(codeVerifier);
  const scopes = ["read:user", "user:email"];
  const state = generateCodeVerifier();
  cliPkceStateStore.set(state, codeVerifier);

  const redirectUri = `${BACKEND_URL}${CLI_REDIRECT_PATH}`;

  return {
    url: `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scopes.join(",")}&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${encodeURIComponent(state)}`,
    codeChallenge,
    state,
  };
}

/**
 * Exchange OAuth code for access token from GitHub
 */
export async function exchangeCodeForGitHubToken(code, callbackUrl = "/auth/github/callback", codeVerifier, state) {
  try {
    const redirectUri = resolveRedirectUri(callbackUrl);

    if (!codeVerifier && state) {
      codeVerifier = getPkceCodeVerifierFromState(state);
      console.log(`  - PKCE state resolved: ${state}`);
    }

    console.log("[OAuth Step 1] Exchanging code for GitHub token");
    console.log(`  - Code: ${code ? code.substring(0, 10) : "MISSING"}`);
    console.log(`  - Redirect URI USED: ${redirectUri}`);
    console.log(`  - Client ID: ${GITHUB_CLIENT_ID ? "✓" : "✗ MISSING"}`);
    console.log(`  - Client Secret: ${GITHUB_CLIENT_SECRET ? "✓" : "✗ MISSING"}`);

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      throw new Error(
        "GitHub OAuth not configured. Check GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables."
      );
    }

    const requestBody = {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    };

    if (codeVerifier) {
      requestBody.code_verifier = codeVerifier;
      console.log(`  - PKCE Code Verifier: ${codeVerifier.substring(0, 10)}...`);
    } else if (callbackUrl === CLI_REDIRECT_PATH) {
      throw new Error(
        "Missing PKCE code verifier for CLI callback. Ensure the CLI flow saved the PKCE state and passed it back on callback."
      );
    }

    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
      requestBody,
      {
        headers: { Accept: "application/json" },
        timeout: 10000,
      }
    );

    if (response.data.error) {
      const errorMsg = `GitHub OAuth error: ${response.data.error} - ${response.data.error_description}`;
      console.error(`❌ ${errorMsg}`);
      
      // Provide specific help for common errors
      if (response.data.error === "bad_verification_code") {
        throw new Error(
          errorMsg +
          "\n\nMost likely causes:\n" +
          "1. OAuth code has expired (valid for 10 minutes)\n" +
          "2. GITHUB_REDIRECT_URL does not match GitHub app settings\n" +
          "3. Code was already used for token exchange"
        );
      } else if (response.data.error === "invalid_request") {
        throw new Error(
          errorMsg +
          "\n\nCheck that GITHUB_REDIRECT_URL matches your GitHub OAuth app settings exactly."
        );
      }

      throw new Error(errorMsg);
    }

    console.log(`✅ [OAuth Step 1] GitHub token received`);
    return response.data.access_token;
  } catch (err) {
    console.error(`❌ [OAuth Step 1] Failed to exchange code: ${err.message}`);
    throw err;
  }
}

/**
 * Fetch user data from GitHub
 */
export async function fetchGitHubUser(accessToken) {
  try {
    console.log("[OAuth Step 2] Fetching GitHub user profile");
    console.log(`  - Access token: ${accessToken.substring(0, 10)}...`);

    const response = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });

    console.log(`  - GitHub ID: ${response.data.id}`);
    console.log(`  - Username: ${response.data.login}`);

    // Also fetch email if not public
    let email = response.data.email;
    if (!email) {
      console.log(`  - Email not public, fetching from /user/emails endpoint`);
      const emailResponse = await axios.get("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });
      const primaryEmail = emailResponse.data.find((e) => e.primary);
      email = primaryEmail?.email;
    }

    console.log(`✅ [OAuth Step 2] GitHub user fetched: ${response.data.login}`);

    return {
      id: response.data.id,
      login: response.data.login,
      email,
      avatar_url: response.data.avatar_url,
      name: response.data.name,
    };
  } catch (err) {
    console.error(`❌ [OAuth Step 2] Failed to fetch GitHub user: ${err.message}`);
    throw err;
  }
}

/**
 * Complete OAuth flow: exchange code for user and generate tokens
 */
export async function completeOAuthFlow(code, callbackUrl = "/auth/github/callback", codeVerifier, state) {
  try {
    console.log("\n🔐 ===== OAUTH FLOW START =====");

    // Step 1: Exchange code for GitHub access token
    const gitHubAccessToken = await exchangeCodeForGitHubToken(code, callbackUrl, codeVerifier, state);

    // Step 2: Fetch user info
    const gitHubUser = await fetchGitHubUser(gitHubAccessToken);

    // Step 3: Create or update user in database
    console.log("[OAuth Step 3] Creating/updating user in database");
    console.log(`  - GitHub ID: ${gitHubUser.id}`);
    console.log(`  - Username: ${gitHubUser.login}`);
    
    try {
      const user = await userModel.createOrUpdateUser(gitHubUser);
      console.log(`✅ [OAuth Step 3] User saved: ID=${user.id}, Role=${user.role}`);

      // Step 4: Check if user is active
      if (!user.is_active) {
        throw new Error(
          `User account is deactivated. Contact administrator to reactivate user ${user.username}.`
        );
      }

      // Step 5: Generate tokens
      console.log("[OAuth Step 4] Generating access and refresh tokens");
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);
      console.log(`✅ [OAuth Step 4] Tokens generated`);

      // Step 6: Store refresh token hash in database
      console.log("[OAuth Step 5] Storing refresh token in database");
      const tokenHash = hashToken(refreshToken);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      
      try {
        await userModel.storeRefreshToken(user.id, tokenHash, expiresAt);
        console.log(`✅ [OAuth Step 5] Refresh token stored`);
      } catch (dbErr) {
        console.error(`❌ [OAuth Step 5] Failed to store refresh token: ${dbErr.message}`);
        throw new Error(
          `Database error storing refresh token: ${dbErr.message}\n\n` +
          "This may mean the 'refresh_tokens' table doesn't exist or database is not accessible."
        );
      }

      console.log("✅ OAUTH FLOW COMPLETE\n");

      return {
        user,
        accessToken,
        refreshToken,
      };
    } catch (dbErr) {
      console.error(`❌ [OAuth Step 3] Database error: ${dbErr.message}`);
      
      // Provide specific error messages for common DB issues
      if (dbErr.message.includes("relation") && dbErr.message.includes("does not exist")) {
        throw new Error(
          `Database table doesn't exist: ${dbErr.message}\n\n` +
          "Run database migrations to create 'users' and 'refresh_tokens' tables.\n" +
          "See SETUP.md or run: npm run migrate"
        );
      } else if (dbErr.message.includes("ECONNREFUSED") || dbErr.message.includes("connect")) {
        throw new Error(
          `Cannot connect to database: ${dbErr.message}\n\n` +
          "Check that DATABASE_URL is set correctly and database is running."
        );
      }
      
      throw dbErr;
    }
  } catch (err) {
    console.error(`\n❌ OAUTH FLOW FAILED: ${err.message}\n`);
    throw err;
  }
}

export default {
  getGitHubAuthorizationUrl,
  getGitHubAuthorizationUrlWithPKCE,
  exchangeCodeForGitHubToken,
  fetchGitHubUser,
  completeOAuthFlow,
};
