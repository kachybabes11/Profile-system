Insigha Backend System Documentation

Overview

The Insigha backend is built using Node.js and Express.js. It serves as the core system responsible for authentication, database management, profile operations, and API routing for all connected clients (Web UI and CLI).

It integrates GitHub OAuth authentication with PKCE support, role-based access control, JWT token management, and comprehensive security middleware.

Base URL
https://profile-system-production.up.railway.app

Technologies Used
Node.js
Express.js
JWT (JSON Web Tokens)
GitHub OAuth 2.0 with PKCE
PostgreSQL (Database)
Node-Cache (Query caching)
Express Rate Limiting
Morgan (Request logging)
CSV Parser (Bulk imports)

Architecture
The system follows a multi-client, single-backend architecture:

WEB UI  ────────┐
                │
CLI  ───────────┼────── BACKEND ─────── DATABASE (PostgreSQL)
                │
             APIs (REST)

All clients communicate with a single backend via REST APIs with JWT authentication.

Key Features
1. Authentication (GitHub OAuth)

Users authenticate via GitHub using Passport.js.

Authentication Flow:
User visits /auth/github
Redirected to GitHub login
User authorizes application
Callback handled at /auth/github/callback
Access token generated
User session is created and stored

2. Rate Limiting
Prevents abuse and excessive API requests
Applied globally and on sensitive routes

3. Protected Routes
Middleware ensures only authenticated users can access secured endpoints.

4. Performance Optimizations (v1.0)

Query Caching: 97% faster repeated queries (<5ms cache hits)
Query Normalization: Deterministic cache keys (70-85% hit rate)
CSV Bulk Ingestion: Stream & batch processing (11k rows/sec)

See [OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md) for details.

Performance Improvements
- Repeated queries: 97% faster (cache hits)
- Cache hit rate: 70-85% due to normalization
- CSV processing: ~11k rows/second (streaming)
- Max upload: 500k rows in <1 minute
- API blocking: None (non-blocking uploads)

4. Profile Management
Create profiles
Fetch profiles
Search profiles
Delete profiles (admin only)
Pagination support

5. Role-Based Access Control (RBAC)
Enforced via middleware.

Roles:
1.Admin
Username: kachybabes11

Full system access
Create profiles
Delete profiles
Export data

2. Analyst
Default role for all other users
Read-only access
Can view profiles and insights

6. API Versioning

All requests must include:
x-api-version: 1 

7. Token Management
Access Token: Short-lived (30 minutes)
Refresh Token: Long-lived (7 days)

Used for maintaining secure sessions across requests.

 API ENDPOINTS
 Auth Routes
Method	
GET	/auth/github	
Start OAuth login

GET	/auth/github/callback	
OAuth callback

GET	/auth/logout	
Logout user

GET	/auth/me	
Get current user

Profile Routes
GET	/api/profiles	
Get all profiles

GET	/api/profiles/:id	
Get single profile

GET	/api/profiles/search?q=	
Search profiles

Protected Routes (Admin Only)
POST	/api/profiles	
Create profile

DELETE	/api/profiles/:id	
Delete profile

Environment Variables
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
JWT_SECRET=
FRONTEND_URL=
DATABASE_URL=

How to Run Backend
npm install
npm run dev

📚 Performance Optimization Documentation

[OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md) - Quick overview of all optimizations
[OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md) - Complete guide (query caching, normalization, CSV ingestion)
[CSV_UPLOAD_API.md](./CSV_UPLOAD_API.md) - CSV upload endpoint API reference
[ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design decisions
[IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) - Setup, testing, and troubleshooting guide

Quick Performance Stats:
- Query speed: 97% faster for repeated queries (caching)
- Cache hit rate: 70-85% (due to normalization)
- CSV upload: ~11,000 rows/second (streaming)
- Max file: 500,000 rows in <1 minute
- API impact: None (non-blocking uploads)

 FINAL NOTE

This backend is designed as a central API service powering both:

Web frontend (UI-based interaction)
CLI tool (terminal-based interaction)

It enforces:

OAuth authentication
Role-based access control
API versioning
Token-based security


