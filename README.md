🧠 1. BACKEND DOCUMENTATION
🔹 Overview

The backend is built using Node.js with Express.js. It handles authentication, profile management, and API endpoints for data access. It also integrates GitHub OAuth for secure user authentication.

🔹 Technologies Used
Node.js
Express.js
Passport.js (GitHub OAuth)
Express Session
Cookie Parser
Rate Limiting Middleware
Database (MongoDB / PostgreSQL — depending on yours)
🔹 Architecture

The backend follows a modular structure:

backend/
│── config/
│   └── passport.js
|   └── db.js   
│── routes/
│   ├── authRoutes.js
│   ├── profileRoutes.js
│   └── insightRoutes.js
│── middleware/
│   ├── authMiddleware.js
│   └── rateLimiter.js
│   └── logger.js
│   └── requireRole.js
│   └── checkVersion.js
│── controllers/
|   └── profileController.js
│── services/
|   └──  externalApiService.js
│── models/
|   └── profileModel.js
|--- utils/
|   └── helpers.js
|   └── queryParser.js
|   └── token.js
│── app.js 
|---server.js
🔹 Key Features
1. Authentication (GitHub OAuth)
Users authenticate via GitHub
Uses Passport strategy
Session-based authentication
Stores user info in database

Flow:

User hits /auth/github
Redirected to GitHub
Callback handled at /auth/github/callback
Access token generated
User session created
2. Rate Limiting
Prevents API abuse
Applied globally or per route
3. Protected Routes
Middleware ensures only authenticated users can access certain endpoints
4. Profile Management
Fetch user profiles
Filter profiles
Pagination support
🔹 API Endpoints
Auth Routes
Method	Endpoint	Description
GET	/auth/github	Start OAuth login
GET	/auth/github/callback	OAuth callback
GET	/auth/logout	Logout user
Profile Routes
Method	Endpoint	Description
GET	/profiles	Get all profiles
GET	/profiles/:id	Get single profile
Insight Routes
Method	Endpoint	Description
GET	/insights	Fetch analytics data
🔹 Environment Variables
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
SESSION_SECRET=
DB_URI=
🔹 How to Run Backend
npm install
npm run dev

Server runs on:

http://localhost:3000
