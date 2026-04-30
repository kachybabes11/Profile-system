Overview
The backend is built using Node.js with Express.js. It handles authentication, database management, profile management, and API endpoints for data access. It also integrates GitHub OAuth for secure user authentication.

Base Url: https://profile-system-production.up.railway.app

Technologies Used
Node.js
Express.js
Passport.js (GitHub OAuth)
Express Session
Cookie Parser
Rate Limiting Middleware
Database (PostgreSQL)

Architecture
The backend follows a modular structure. It follows a multi client, single backend architecture

WEB UI------ BACKEND ----- CLI
               | 
            DATABASE
            
 Key Features
1. Authentication (GitHub OAuth)
Users authenticate via GitHub
Uses Passport strategy
Session-based authentication
Stores user info in database

Authentication Flow:
-User hits /auth/github
-Redirected to GitHub
-Callback handled at /auth/github/callback
-Access token generated
-User session created

2. Rate Limiting
Prevents API abuse
Applied globally or per route

4. Protected Routes
Middleware ensures only authenticated users can access certain endpoints

5. Profile Management
Fetch user profiles
Filter profiles
Pagination support

6. Role-Based Access control: It is enforced using middleware on protected routes
a. Admin: kachybabes11
  -Full access
  -can export CSV
  -create and delete profiles
   
b. Analyst : every login asides kachybabes11
  -read only
   
7. API versioning
   -header:
   key = [x-api-version]
   value = 1
   
8. Access and refresh token management
   -access token : short-lived(30 minutes);
   -refresh token : long lived (7 days)


API Endpoints

Auth Routes
Method	Endpoint	Description

GET /auth/github	
Start OAuth login

GET	/auth/github/callback	
OAuth callback

GET	/auth/logout	
Logout user

Profile Routes
Method	
GET	api/v1/profiles
Get all profiles

GET	api/v1/profiles/:id	
Get single profile

GET api/v1/profiles/search?q=(name)
Get searched Profile

Protected Routes
POST api/v1/profiles
Add a single profile

DELETE api/v1/profiles/:id
Delete a single profile

Insighta Routes
Method	Endpoint	Description
GET	/insighta/ me
Fetch current user

GET /insighta/role
Fetch current user role

Environment Variables
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
JWT_SECRET=
FRONTEND_URL=

How to Run Backend
npm install
npm run dev

http://localhost:3000
