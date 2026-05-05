import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import { validateOAuthConfig, validateDatabaseConnection } from "./services/oauthService.js";

const PORT = process.env.PORT || 3000;

// Validate configuration before starting
async function startup() {
  console.log("\n🔍 Validating configuration...\n");

  // Check OAuth settings
  const oauthValid = validateOAuthConfig();

  // Check database connection
  const dbValid = await validateDatabaseConnection();

  if (!oauthValid) {
    console.error("\n❌ OAuth configuration incomplete. Server cannot start.\n");
    process.exit(1);
  }

  if (!dbValid) {
    console.warn("\n⚠️  Database connection failed. Some features may not work.\n");
  }

  // Start server
  app.listen(PORT, () => {
    console.log(`\n✅ Server running on port ${PORT}\n`);
  });
}

startup().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});