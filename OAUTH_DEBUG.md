# OAuth Authentication Debugging Guide

## Quick Diagnosis

When OAuth fails with "Authentication failed", follow these steps in order:

### Step 1: Check Server Startup Logs

Run `npm start` and look for validation output:

```bash
npm start
```

You should see:
```
🔍 Validating configuration...

✅ Database connection verified
✅ Server running on port 3000
```

**If you see errors**, jump to that section below.

---

## Common Failures & Fixes

### ❌ Error: `GITHUB_CLIENT_ID environment variable is not set`

**Root Cause**: Missing GitHub OAuth credentials

**Fix**:
1. Go to https://github.com/settings/oauth-apps
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: Insighta Labs
   - **Homepage URL**: `http://localhost:3000` (or your domain)
   - **Authorization callback URL**: `http://localhost:3000/auth/github/callback`
4. Copy `Client ID` and generate `Client Secret`
5. Add to `.env`:
   ```env
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   ```
6. Restart server: `npm start`

---

### ❌ Error: `GITHUB_REDIRECT_URL not set. Using default...`

**Root Cause**: Redirect URL mismatch (most common OAuth failure)

**What's happening**:
```
GitHub app expects: https://yourdomain.com/auth/github/callback
But system trying:  http://localhost:3000/auth/github/callback
↓
GitHub rejects the request with: bad_verification_code
```

**Fix for Development**:
```env
# In .env
GITHUB_REDIRECT_URL=http://localhost:3000/auth/github/callback
```

**Fix for Production**:
```env
# In .env (production)
GITHUB_REDIRECT_URL=https://yourdomain.com/auth/github/callback
BACKEND_URL=https://yourdomain.com
```

**IMPORTANT**: This URL MUST match exactly what's registered in GitHub app settings:
- https://github.com/settings/oauth-apps
- Click your app
- Edit "Authorization callback URL"
- Make sure it matches `GITHUB_REDIRECT_URL` exactly (including http vs https)

---

### ❌ Error: `Database connection failed`

**Root Cause**: PostgreSQL connection issues

**Check these**:

1. **DATABASE_URL is set**:
   ```bash
   echo $DATABASE_URL  # Should show postgresql://...
   ```

2. **Database is running** (if local):
   ```bash
   psql -U postgres  # Should connect
   ```

3. **Credentials are correct**:
   ```bash
   psql postgresql://user:password@localhost:5432/database_name
   ```

4. **Fix `.env`**:
   ```env
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   ```

5. **Restart server**: `npm start`

---

### ❌ Error: `relation "users" does not exist`

**Root Cause**: Database tables not created

**Fix**: Run migrations
```bash
npm run migrate
```

Or manually create tables (PostgreSQL):
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id INTEGER UNIQUE NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  avatar_url TEXT,
  role VARCHAR(50) DEFAULT 'analyst',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
```

---

### ❌ Error: `JWT_SECRET not set. Using insecure default`

**Root Cause**: Tokens use weak secret key

**Fix**:
```bash
# Generate a strong random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:
```env
JWT_SECRET=your_generated_secret
```

**Important**: Different for each environment:
- Development: Can be any value (set in .env)
- Production: Must be strong and secret (use env vars, secret manager, etc.)

---

## Detailed Execution Trace with Logs

When OAuth fails, look at the console output to find which step failed:

### Web OAuth Flow Logs

```
[WEB OAuth Callback] {
  code: 'abc123456...',
  error: null,
  error_description: null
}

[OAuth Step 1] Exchanging code for GitHub token
  - Code: abc123456...
  - Redirect URI: http://localhost:3000/auth/github/callback
  - Client ID: ✓
  - Client Secret: ✓

❌ [OAuth Step 1] Failed to exchange code: GitHub OAuth error: bad_verification_code - The OAuth code has expired or is invalid. Authorization code must be used within 10 minutes of creation.
```

**This means**: Redirect URI doesn't match GitHub app settings

---

### CLI OAuth Flow Logs

```
🔐 ===== OAUTH FLOW START =====

[OAuth Step 1] Exchanging code for GitHub token
  - Code: abc123456...
  - Redirect URI: http://localhost:3000/auth/github/callback
  - Client ID: ✓
  - Client Secret: ✓
  - PKCE Code Verifier: abc123456...

✅ [OAuth Step 1] GitHub token received

[OAuth Step 2] Fetching GitHub user profile
  - Access token: ghu_123abc...
  - GitHub ID: 12345678
  - Username: octocat

✅ [OAuth Step 2] GitHub user fetched: octocat

[OAuth Step 3] Creating/updating user in database
  - GitHub ID: 12345678
  - Username: octocat

❌ [OAuth Step 3] Database error: ECONNREFUSED connection refused

✅ OAUTH FLOW COMPLETE
```

**This means**: Database is not running or not reachable

---

## Testing OAuth Flow Manually

### Test 1: Check GitHub App Configuration

```bash
# Should succeed if GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are correct
curl -X POST https://github.com/login/oauth/access_token \
  -H "Accept: application/json" \
  -d "client_id=YOUR_CLIENT_ID&client_secret=YOUR_SECRET&code=INVALID_CODE&redirect_uri=YOUR_REDIRECT_URI"
```

**Expected response** (even with invalid code, auth should fail gracefully):
```json
{
  "error": "bad_verification_code",
  "error_description": "The OAuth code has expired or is invalid. Authorization code must be used within 10 minutes of creation."
}
```

**If you get** `Client Authentication Failed`:
- ❌ GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is wrong

---

### Test 2: Check Database Connection

```bash
# Test connection string
psql $DATABASE_URL -c "SELECT NOW();"
```

**Expected**: Current timestamp
**If error**: Fix DATABASE_URL and restart

---

### Test 3: Check Web OAuth URL Generation

```bash
curl -s http://localhost:3000/auth/github
```

**Expected**: Redirect to GitHub with correct parameters
```
Location: https://github.com/login/oauth/authorize?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fgithub%2Fcallback&
  scope=read%3Auser%2Cuser%3Aemail
```

**Check**: `redirect_uri` matches your GitHub app Authorization callback URL

---

### Test 4: Check CLI Callback Endpoint

```bash
curl -X POST http://localhost:3000/auth/cli/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "INVALID_CODE",
    "codeVerifier": "test123",
    "redirect_uri": "http://localhost:3000/auth/github/callback"
  }'
```

**Expected response** (with detailed error):
```json
{
  "status": "error",
  "message": "Authentication failed",
  "details": "GitHub OAuth error: bad_verification_code - The OAuth code has expired or is invalid.",
  "error_code": "OAUTH_ERROR",
  "hint": "Check that code is valid, redirect_uri matches GitHub app, and environment variables are set."
}
```

---

## Environment Checklist

Run this to verify all settings:

```bash
echo "=== OAuth Configuration ==="
echo "GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID:- NOT SET}"
echo "GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET:- NOT SET}"
echo "GITHUB_REDIRECT_URL: ${GITHUB_REDIRECT_URL:- NOT SET (using default)}"
echo "BACKEND_URL: ${BACKEND_URL:- NOT SET (using default)}"
echo ""
echo "=== Database Configuration ==="
echo "DATABASE_URL: ${DATABASE_URL:- NOT SET}"
echo ""
echo "=== JWT Configuration ==="
echo "JWT_SECRET: ${JWT_SECRET:- NOT SET (using default - INSECURE!)}"
echo ""
echo "=== Frontend Configuration ==="
echo "FRONTEND_URL: ${FRONTEND_URL:- NOT SET (using default: http://localhost:4000)}"
echo ""
echo "=== Server Configuration ==="
echo "NODE_ENV: ${NODE_ENV:- NOT SET (using default: development)}"
echo "PORT: ${PORT:- NOT SET (using default: 3000)}"
```

---

## OAuth Flow Diagram with Failure Points

```
┌─ User clicks "Login with GitHub"
│
├─ Browser redirects to: https://github.com/login/oauth/authorize?
│  client_id=XXX&redirect_uri=http://localhost:3000/auth/github/callback&...
│
├─ GitHub OAuth page (user authorizes)
│
├─ GitHub redirects to: http://localhost:3000/auth/github/callback?code=abc123
│
├─ Backend receives callback
│
├─ Step 1: Exchange code for access_token
│  ├─ POST to https://github.com/login/oauth/access_token
│  ├─ Params: client_id, client_secret, code, redirect_uri
│  │
│  ├─ ❌ FAIL: bad_verification_code
│  │    → Redirect URI mismatch or code expired
│  │
│  └─ ✅ SUCCESS: Returns access_token
│
├─ Step 2: Fetch user profile from GitHub API
│  ├─ GET https://api.github.com/user
│  │
│  ├─ ❌ FAIL: Invalid access_token
│  │    → Token not provided or malformed
│  │
│  └─ ✅ SUCCESS: Returns user data (id, login, email, avatar_url)
│
├─ Step 3: Create/update user in database
│  ├─ INSERT or UPDATE users table
│  │
│  ├─ ❌ FAIL: Connection refused
│  │    → Database not running or not accessible
│  │
│  ├─ ❌ FAIL: relation "users" does not exist
│  │    → Tables not created (run migrations)
│  │
│  └─ ✅ SUCCESS: User saved with role assignment
│
├─ Step 4: Check if user is active
│  ├─ ❌ FAIL: User deactivated
│  │    → Account disabled by admin
│  │
│  └─ ✅ SUCCESS: Proceed
│
├─ Step 5: Generate JWT tokens
│  ├─ Create access_token (3 min expiry)
│  ├─ Create refresh_token (5 min expiry)
│  │
│  ├─ ❌ FAIL: JWT_SECRET not set
│  │    → Tokens cannot be signed
│  │
│  └─ ✅ SUCCESS: Tokens created
│
├─ Step 6: Store refresh token hash in database
│  ├─ INSERT into refresh_tokens table
│  │
│  ├─ ❌ FAIL: Table doesn't exist
│  │    → Run migrations
│  │
│  └─ ✅ SUCCESS: Token hash stored
│
└─ Return to client
   ├─ Web: Set HTTP-only cookies, redirect to /dashboard
   └─ CLI: Return JSON with access_token, refresh_token
```

---

## Still Not Working?

1. **Enable debug logging**:
   ```bash
   DEBUG=* npm start  # If using debug module
   ```

2. **Check logs in real-time**:
   ```bash
   npm start 2>&1 | grep -i "oauth\|error\|failed"
   ```

3. **Test with Postman**:
   - Import `tests/postman_collection.json`
   - Run OAuth callback test with real code from GitHub

4. **Create GitHub issue** with:
   - Full error message from logs
   - Environment variables (sanitized)
   - Browser/client type (web vs CLI)
   - Steps to reproduce

---

## Summary: Fix Priority

If OAuth is failing, fix in this order:

1. ✅ Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set
2. ✅ Verify `GITHUB_REDIRECT_URL` matches GitHub app settings (most common issue!)
3. ✅ Ensure database is running and `DATABASE_URL` is correct
4. ✅ Run migrations to create tables
5. ✅ Set `JWT_SECRET` to avoid warnings
6. ✅ Restart server after each fix

Nine times out of ten, it's **#2 — redirect_uri mismatch**.