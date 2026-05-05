# Role-Based Access Control (RBAC) System

## Overview

The Profile Intelligence System implements a role-based access control middleware that enforces role-based authorization across all protected API endpoints.

## Roles

The system supports two user roles:

1. **Admin** - Full system access
   - First 3 users automatically assigned as admin
   - Create, read, update, delete profiles
   - Export data as CSV
   - Manage user access

2. **Analyst** - Read-only and limited write access
   - All users after the first 3
   - View profiles
   - Search profiles
   - Cannot create, delete, or modify profiles

## Automatic Role Assignment

When a new user logs in via GitHub OAuth:

1. The system counts existing users in the database
2. If user count < 3: User is assigned **admin** role
3. If user count ≥ 3: User is assigned **analyst** role

This ensures the first 3 users get administrative privileges automatically.

### Implementation

**File:** `models/userModel.js`

```javascript
export async function createOrUpdateUser(githubData) {
  // Count existing users
  const countQuery = "SELECT COUNT(*) as user_count FROM users";
  const countResult = await pool.query(countQuery);
  const userCount = parseInt(countResult.rows[0].user_count);

  // First 3 users are admin, rest are analyst
  const role = userCount < 3 ? 'admin' : 'analyst';

  // Insert user with assigned role
  // ...
}
```

## Middleware Implementation

**File:** `middleware/requireRole.js`

```javascript
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "Forbidden"
      });
    }
    next();
  };
}
```

### How It Works

1. Middleware checks if the authenticated user exists
2. Compares user's role against allowed roles
3. If match found, proceeds to next middleware/handler
4. If no match, returns 403 Forbidden with error message

## API Routes with Role Protection

**File:** `routes/profileRoutes.js`

### Protected by Admin Role

```
POST   /api/profiles              - Create profile (admin only)
GET    /api/profiles              - List profiles (admin only)
GET    /api/profiles/export       - Export as CSV (admin only)
DELETE /api/profiles/:id          - Delete profile (admin only)
POST   /api/profiles/upload/csv   - Upload CSV (admin only)
```

### Protected by Authentication (Any Role)

```
GET    /api/profiles/search       - Search profiles (any authenticated user)
GET    /api/profiles/:id          - View single profile (any authenticated user)
```

## Usage Examples

### Single Role Check

```javascript
import { requireRole } from "../middleware/requireRole.js";

// Require admin role only
router.delete("/profiles/:id", authMiddleware, requireRole("admin"), deleteProfile);
```

### Multiple Roles Check

```javascript
// Allow both admin and analyst
router.get("/profiles", authMiddleware, requireRole("admin", "analyst"), getProfiles);
```

## Middleware Chain

Standard route protection order:

```
authMiddleware → apiVersionMiddleware → requireRole(...roles) → handler
```

1. **authMiddleware**: Verifies JWT token, decodes user info
2. **apiVersionMiddleware**: Validates API version header
3. **requireRole**: Checks user's role against allowed roles
4. **handler**: Route handler if all middleware passes

## Database Schema

**Table:** `users`

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id INTEGER UNIQUE NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  avatar_url VARCHAR(500),
  role VARCHAR(50) DEFAULT 'analyst' 
    CHECK (role IN ('admin', 'analyst')),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Testing Role Assignment

Run the test script to verify role assignment logic:

```bash
node test-roles.js
```

Output:
```
✅ admin1: admin (expected: admin)
✅ admin2: admin (expected: admin)
✅ admin3: admin (expected: admin)
✅ analyst1: analyst (expected: analyst)
✅ analyst2: analyst (expected: analyst)
```

## Error Responses

### 401 Unauthorized
User not authenticated:
```json
{
  "status": "error",
  "message": "Unauthorized"
}
```

### 403 Forbidden
User lacks required role:
```json
{
  "status": "error",
  "message": "Forbidden"
}
```

## Best Practices

1. **Always check role before sensitive operations**
   - Creating/deleting data
   - Exporting data
   - Managing users

2. **Apply authentication middleware first**
   - authMiddleware should come before requireRole
   - This ensures user data is available for role check

3. **Use specific roles**
   - Instead of `requireRole()`, use `requireRole("admin")`
   - More explicit and maintainable

4. **Log authorization failures**
   - Track unauthorized access attempts
   - Useful for security audits

## Changing User Roles

To manually change a user's role:

```javascript
// Update user role in database
const query = `
  UPDATE users 
  SET role = $1 
  WHERE id = $2 
  RETURNING *;
`;
const result = await pool.query(query, ["admin", userId]);
```

## Future Enhancements

1. **Dynamic role assignment**
   - Allow admins to promote/demote users
   - Create custom roles

2. **Permission-based access**
   - Fine-grained permissions instead of just roles
   - Example: "can_export", "can_delete"

3. **Role expiration**
   - Temporary admin access
   - Scheduled role changes

4. **Audit logging**
   - Log all role-based access decisions
   - Track authorization failures
