import axios from "axios";
import * as userModel from "../models/userModel.js";
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
  console.warn(" GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.");
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
export function getGitHubAuthorizationUrlWithPKCE(codeVerifier, callbackPort = 3001) {
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const scopes = ["read:user", "user:email"];
  const redirectUri = `http://localhost:${callbackPort}/callback`;

  const state = Buffer.from(JSON.stringify({ codeChallenge })).toString("base64");

  return {
    url: `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scopes.join(
      ","
    )}&allow_signup=false&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`,
    codeChallenge,
  };
}

/**
 * Exchange OAuth code for access token from GitHub
 */
export async function exchangeCodeForGitHubToken(code, callbackUrl = "/auth/github/callback", codeVerifier) {
  try {
    const redirectUri = resolveRedirectUri(callbackUrl);

    const requestBody = {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    };

    if (codeVerifier) {
      requestBody.code_verifier = codeVerifier;
    }

    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
      requestBody,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (response.data.error) {
      throw new Error(`GitHub OAuth error: ${response.data.error_description}`);
    }

    return response.data.access_token;
  } catch (err) {
    console.error("Failed to exchange OAuth code:", err.message);
    throw err;
  }
}

/**
 * Fetch user data from GitHub
 */
export async function fetchGitHubUser(accessToken) {
  try {
    const response = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Also fetch email if not public
    let email = response.data.email;
    if (!email) {
      const emailResponse = await axios.get("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const primaryEmail = emailResponse.data.find((e) => e.primary);
      email = primaryEmail?.email;
    }

    return {
      id: response.data.id,
      login: response.data.login,
      email,
      avatar_url: response.data.avatar_url,
      name: response.data.name,
    };
  } catch (err) {
    console.error("Failed to fetch GitHub user:", err.message);
    throw err;
  }
}

/**
 * Complete OAuth flow: exchange code for user and generate tokens
 */
export async function completeOAuthFlow(code, callbackUrl = "/auth/github/callback", codeVerifier) {
  try {
    // Step 1: Exchange code for GitHub access token
    const gitHubAccessToken = await exchangeCodeForGitHubToken(code, callbackUrl, codeVerifier);

    // Step 2: Fetch user info
    const gitHubUser = await fetchGitHubUser(gitHubAccessToken);

    // Step 3: Create or update user in database
    const user = await userModel.createOrUpdateUser(gitHubUser);

    // Step 4: Check if user is active
    if (!user.is_active) {
      throw new Error("User account is deactivated");
    }

    // Step 5: Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Step 6: Store refresh token hash in database
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await userModel.storeRefreshToken(user.id, tokenHash, expiresAt);

    return {
      user,
      accessToken,
      refreshToken,
    };
  } catch (err) {
    console.error("OAuth flow error:", err);
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
