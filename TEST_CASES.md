# Comprehensive Test Cases for Profile Intelligence System

## Overview
This document provides comprehensive test cases for the Profile Intelligence System, covering backend APIs, CLI tool, authentication flows, and security features.

**Base URL**: `https://profile-system-production.up.railway.app`
**Test Environment**: Production-ready system with PostgreSQL database

---

## 1. Authentication Test Cases

### 1.1 GitHub OAuth Web Flow
**Test ID**: AUTH_001
**Type**: Integration Test
**Priority**: Critical

**Preconditions**:
- Valid GitHub OAuth credentials configured
- User has GitHub account

**Test Steps**:
1. Navigate to `GET /auth/github`
2. Complete GitHub OAuth flow
3. Verify redirect to frontend with success

**Expected Results**:
- HTTP 302 redirect to GitHub OAuth
- Successful callback sets HTTP-only cookies
- User redirected to frontend dashboard

**Test Data**:
```json
{
  "github_user": "testuser",
  "expected_role": "analyst"
}
```

### 1.2 GitHub OAuth CLI Flow (PKCE)
**Test ID**: AUTH_002
**Type**: Integration Test
**Priority**: Critical

**Preconditions**:
- CLI tool installed: `npm install -g insighta-cli`
- Local callback server can run on port 3001

**Test Steps**:
1. Run `insighta login`
2. Verify browser opens with GitHub OAuth URL
3. Complete OAuth flow
4. Verify CLI receives tokens and stores credentials

**Expected Results**:
- Browser opens with PKCE-enabled OAuth URL
- Local server receives callback
- Tokens stored in `~/.insighta/credentials.json`
- CLI shows success message

**Test Data**:
```json
{
  "expected_token_types": ["access_token", "refresh_token"],
  "access_token_expiry": "3 minutes",
  "refresh_token_expiry": "5 minutes"
}
```

### 1.3 Token Refresh Flow
**Test ID**: AUTH_003
**Type**: Integration Test
**Priority**: High

**Preconditions**:
- User logged in with valid tokens
- Access token expired (simulate by waiting or modifying expiry)

**Test Steps**:
1. Make API request with expired access token
2. Verify automatic token refresh
3. Confirm request succeeds with new token

**Expected Results**:
- 401 response triggers refresh
- New tokens issued
- Original request retries successfully
- Refresh token revoked after use

### 1.4 Invalid Token Handling
**Test ID**: AUTH_004
**Type**: Security Test
**Priority**: High

**Test Steps**:
1. Use malformed JWT token
2. Use expired token
3. Use token with invalid signature

**Expected Results**:
- HTTP 401 Unauthorized
- Error message: "Invalid token"
- No sensitive information leaked

---

## 2. Profile API Test Cases

### 2.1 Get Profiles List (Admin)
**Test ID**: API_001
**Type**: API Test
**Priority**: High

**Request**:
```http
GET /api/profiles?page=1&limit=10
Authorization: Bearer <admin_token>
X-API-Version: 1
```

**Expected Response**:
```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 150,
  "total_pages": 15,
  "data": [
    {
      "id": "uuid",
      "name": "John Doe",
      "gender": "male",
      "age": 25,
      "country_name": "United States"
    }
  ],
  "links": {
    "self": "/api/profiles?page=1&limit=10",
    "next": "/api/profiles?page=2&limit=10",
    "prev": null
  }
}
```

### 2.2 Create Profile (Admin Only)
**Test ID**: API_002
**Type**: API Test
**Priority**: High

**Request**:
```http
POST /api/profiles
Authorization: Bearer <admin_token>
X-API-Version: 1
Content-Type: application/json

{
  "name": "Alice Johnson"
}
```

**Expected Response**:
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "name": "Alice Johnson",
    "gender": "female",
    "gender_probability": 0.95,
    "age": 28,
    "age_group": "25-34",
    "country_id": "US",
    "country_name": "United States",
    "country_probability": 0.87,
    "created_at": "2026-05-04T10:00:00Z",
    "created_by": "admin_user_id"
  }
}
```

### 2.3 Natural Language Search
**Test ID**: API_003
**Type**: API Test
**Priority**: High

**Test Cases**:
| Query | Expected Filters |
|-------|------------------|
| "young females in Nigeria" | gender=female, age_group=18-24, country_name=Nigeria |
| "men over 50 from Canada" | gender=male, min_age=50, country_name=Canada |
| "asian teenagers" | country_name=China|Japan|Korea, age_group=13-19 |

**Request**:
```http
GET /api/profiles/search?q=young%20females%20in%20Nigeria
Authorization: Bearer <token>
X-API-Version: 1
```

### 2.4 CSV Export
**Test ID**: API_004
**Type**: API Test
**Priority**: Medium

**Request**:
```http
GET /api/profiles/export?gender=female&min_age=20&max_age=30
Authorization: Bearer <admin_token>
X-API-Version: 1
Accept: application/json
```

**Expected Response**:
```json
{
  "status": "success",
  "data": "id,name,gender,gender_probability,age,age_group,country_id,country_name,country_probability,created_at\nuuid,Alice,female,0.95,25,20-29,US,United States,0.87,2026-05-04T10:00:00Z"
}
```

### 2.5 CSV Upload
**Test ID**: API_005
**Type**: Integration Test
**Priority**: High

**Preconditions**:
- CSV file with valid headers: name,gender,age,country_name
- At least 100 rows

**Request**:
```http
POST /api/profiles/upload/csv
Authorization: Bearer <admin_token>
X-API-Version: 1
Content-Type: multipart/form-data

file: profiles.csv
```

**Expected Response**:
```json
{
  "status": "success",
  "total_rows": 100,
  "inserted": 95,
  "skipped": 5,
  "reasons": ["Duplicate name: John Doe", "Invalid age: -5"]
}
```

---

## 3. CLI Command Test Cases

### 3.1 CLI Login Command
**Test ID**: CLI_001
**Type**: CLI Test
**Priority**: Critical

**Command**:
```bash
insighta login
```

**Expected Output**:
```
🔗 Opening browser for GitHub authentication...
📱 If browser doesn't open, visit: https://github.com/login/oauth/authorize?...
🔄 Waiting for OAuth callback on http://localhost:3001/callback
✅ Logged in as: testuser
🎭 Role: analyst
```

### 3.2 CLI List Profiles
**Test ID**: CLI_002
**Type**: CLI Test
**Priority**: High

**Command**:
```bash
insighta list --page 1 --limit 5
```

**Expected Output**:
```
📋 Profiles (Page 1/20, Total: 100)
ID                                    Name                 Gender    Age  Country
------------------------------------ -------------------- ---------- ---- ----------------
01f8d6e7-8b9c-4d5e-9f0a-1b2c3d4e5f6  John Doe             male      25   United States
02f8d6e7-8b9c-4d5e-9f0a-1b2c3d4e5f7  Jane Smith           female    30   Canada

Links: Self: /api/profiles?page=1&limit=5
Next: /api/profiles?page=2&limit=5
```

### 3.3 CLI Export Command
**Test ID**: CLI_003
**Type**: CLI Test
**Priority**: Medium

**Command**:
```bash
insighta export
```

**Expected Output**:
```
📁 Exported successfully to: /current/directory/profiles.csv
```

**Verification**:
- Check CSV file exists
- Verify CSV format and data

### 3.4 CLI Error Handling
**Test ID**: CLI_004
**Type**: CLI Test
**Priority**: Medium

**Test Cases**:
| Scenario | Command | Expected Error |
|----------|---------|----------------|
| Not logged in | `insighta list` | "❌ Not logged in. Run 'insighta login' first." |
| Invalid token | `insighta me` | "❌ Token expired. Run 'insighta refresh' or 'insighta login' again." |
| Permission denied | `insighta create test` (as analyst) | "❌ Forbidden - you do not have permission" |

---

## 4. Security Test Cases

### 4.1 Rate Limiting
**Test ID**: SEC_001
**Type**: Security Test
**Priority**: High

**Test Steps**:
1. Make 15 requests to `/auth/github` in 1 minute
2. Make 70 requests to `/api/profiles` in 1 minute

**Expected Results**:
- Auth endpoints: 429 after 10 requests
- API endpoints: 429 after 60 requests
- Proper headers: `X-RateLimit-Remaining`, `Retry-After`

### 4.2 Role-Based Access Control
**Test ID**: SEC_002
**Type**: Security Test
**Priority**: Critical

**Test Matrix**:
| Endpoint | Admin | Analyst | Anonymous |
|----------|-------|---------|-----------|
| GET /api/profiles | ✅ | ✅ | ❌ 401 |
| POST /api/profiles | ✅ | ❌ 403 | ❌ 401 |
| DELETE /api/profiles/:id | ✅ | ❌ 403 | ❌ 401 |
| GET /api/profiles/export | ✅ | ❌ 403 | ❌ 401 |

### 4.3 API Version Enforcement
**Test ID**: SEC_003
**Type**: Security Test
**Priority**: Medium

**Test Cases**:
| Request | Expected Result |
|---------|----------------|
| No X-API-Version header | 400 Bad Request |
| X-API-Version: 2 | 400 Bad Request |
| X-API-Version: 1 | ✅ Success |

### 4.4 SQL Injection Prevention
**Test ID**: SEC_004
**Type**: Security Test
**Priority**: Critical

**Test Payloads**:
```json
{
  "name": "'; DROP TABLE profiles; --",
  "search_query": "1' OR '1'='1"
}
```

**Expected Results**:
- No SQL injection possible
- Input properly sanitized
- Safe error messages

---

## 5. Performance Test Cases

### 5.1 Query Caching Performance
**Test ID**: PERF_001
**Type**: Performance Test
**Priority**: High

**Test Steps**:
1. Execute same query 100 times
2. Measure response times
3. Verify cache hit rate > 70%

**Expected Results**:
- First request: 150-200ms (cache miss)
- Subsequent requests: < 10ms (cache hit)
- Cache hit rate: 85-95%

### 5.2 CSV Upload Performance
**Test ID**: PERF_002
**Type**: Performance Test
**Priority**: High

**Test Data**:
- 10,000 row CSV file (5MB)
- 100,000 row CSV file (25MB)

**Expected Results**:
- 10k rows: < 30 seconds
- 100k rows: < 120 seconds
- Memory usage < 500MB
- No crashes or timeouts

### 5.3 Concurrent User Load
**Test ID**: PERF_003
**Type**: Load Test
**Priority**: Medium

**Test Setup**:
- 50 concurrent users
- Mix of read/write operations
- Duration: 5 minutes

**Expected Results**:
- Average response time < 500ms
- Error rate < 1%
- Database connections stable

---

## 6. Edge Cases and Error Handling

### 6.1 Invalid Profile Data
**Test ID**: EDGE_001
**Type**: Edge Case Test
**Priority**: Medium

**Test Cases**:
| Input | Expected Error |
|-------|----------------|
| Empty name | "Missing or empty name" |
| Name with special chars | ✅ Accepted (sanitized) |
| Name > 100 chars | "Name too long" |
| Invalid JSON | "Invalid request format" |

### 6.2 External API Failures
**Test ID**: EDGE_002
**Type**: Error Handling Test
**Priority**: Medium

**Test Scenarios**:
- Genderize API down
- Agify API timeout
- Nationalize API invalid response

**Expected Results**:
- Graceful degradation
- Partial data still saved
- Proper error logging
- User-friendly error messages

### 6.3 Database Connection Issues
**Test ID**: EDGE_003
**Type**: Error Handling Test
**Priority**: High

**Test Steps**:
1. Disconnect database during request
2. Verify connection pool recovery
3. Check error responses

**Expected Results**:
- Connection pool recovers automatically
- Proper 500 errors returned
- No sensitive data exposed

### 6.4 File Upload Edge Cases
**Test ID**: EDGE_004
**Type**: Edge Case Test
**Priority**: Medium

**Test Files**:
- Empty CSV
- CSV with wrong headers
- CSV with malformed rows
- Non-CSV file
- 100MB+ file (exceeds limit)

**Expected Results**:
- Proper validation errors
- No server crashes
- Clear error messages

---

## 7. Integration Test Cases

### 7.1 End-to-End User Flow
**Test ID**: INT_001
**Type**: End-to-End Test
**Priority**: Critical

**Test Steps**:
1. User logs in via CLI
2. Creates profile (admin only)
3. Searches for profiles
4. Exports data
5. Logs out

**Expected Results**:
- All steps complete successfully
- Data consistency maintained
- Proper cleanup on logout

### 7.2 Cross-Client Consistency
**Test ID**: INT_002
**Type**: Integration Test
**Priority**: High

**Test Steps**:
1. Create profile via API
2. Verify visible in CLI list
3. Update via different client
4. Verify cache invalidation

**Expected Results**:
- Data consistency across clients
- Cache properly invalidated
- Real-time updates

---

## 8. Automated Test Scripts

### 8.1 Backend API Tests (Jest/Supertest)
```javascript
// tests/api/profiles.test.js
describe('Profile API', () => {
  test('GET /api/profiles returns paginated results', async () => {
    const response = await request(app)
      .get('/api/profiles')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-API-Version', '1');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data).toBeInstanceOf(Array);
  });
});
```

### 8.2 CLI Tests (Shell Scripts)
```bash
#!/bin/bash
# tests/cli/login.test.sh

echo "Testing CLI login..."
output=$(insighta login 2>&1)
if [[ $output == *"✅ Logged in"* ]]; then
  echo "✅ Login test passed"
else
  echo "❌ Login test failed"
  exit 1
fi
```

### 8.3 Load Testing (Artillery)
```yaml
# tests/load/profiles.yml
config:
  target: 'https://profile-system-production.up.railway.app'
  phases:
    - duration: 60
      arrivalRate: 10

scenarios:
  - name: 'Profile search'
    weight: 70
    requests:
      - get:
          url: '/api/profiles/search'
          qs:
            q: 'young females'
          headers:
            Authorization: 'Bearer {{token}}'
            X-API-Version: '1'

  - name: 'Create profile'
    weight: 30
    requests:
      - post:
          url: '/api/profiles'
          headers:
            Authorization: 'Bearer {{adminToken}}'
            X-API-Version: '1'
          json:
            name: 'Test User {{ $randomInt }}'
```

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Database migrated with test data
- [ ] Environment variables configured
- [ ] CLI tool installed globally
- [ ] Test user accounts created

### Test Execution Order
1. [ ] Unit Tests (individual functions)
2. [ ] Authentication Tests (login flows)
3. [ ] API Tests (CRUD operations)
4. [ ] CLI Tests (command functionality)
5. [ ] Security Tests (RBAC, rate limiting)
6. [ ] Performance Tests (load testing)
7. [ ] Integration Tests (end-to-end flows)

### Post-Test Cleanup
- [ ] Test data removed
- [ ] Cache cleared
- [ ] Tokens revoked
- [ ] Log files archived

---

**Test Environment Requirements**:
- Node.js 18+
- PostgreSQL database
- GitHub OAuth app configured
- Network access to external APIs
- 2GB+ RAM for load testing

**Success Criteria**:
- All critical tests pass (100%)
- High priority tests pass (95%+)
- Performance benchmarks met
- No security vulnerabilities
- Error handling works correctly</content>
<parameter name="filePath">c:\Users\Laura\OneDrive\Desktop\Profile system\TEST_CASES.md