/**
 * scripts/createAdmin.js
 * Create or promote a user to ADMIN role.
 *
 * Usage:
 *   node Backend/scripts/createAdmin.js --email admin@example.com --password Secret123!
 *   node Backend/scripts/createAdmin.js --email admin@example.com --name "Super Admin" --password Secret123!
 *
 * Or via env vars (useful in CI):
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=Secret123! node Backend/scripts/createAdmin.js
 */

import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/models/User.js";

// ── Parse CLI args ────────────────────────────────────────────────────────────
function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const email =
  getArg("--email") || process.env.ADMIN_EMAIL;
const password =
  getArg("--password") || process.env.ADMIN_PASSWORD;
const name =
  getArg("--name") || process.env.ADMIN_NAME || "Admin";

if (!email || !password) {
  console.error(
    "Usage: node Backend/scripts/createAdmin.js --email <email> --password <password> [--name <name>]"
  );
  console.error(
    "Or set ADMIN_EMAIL and ADMIN_PASSWORD environment variables."
  );
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("ERROR: MONGODB_URI is not set in .env");
  process.exit(1);
}

async function main() {
  console.log("Connecting to MongoDB…");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected.\n");

  const existing = await User.findOne({ email: email.toLowerCase().trim() });

  if (existing) {
    existing.role = "ADMIN";
    existing.isBlocked = false;
    await existing.save();
    console.log(`✅  Promoted existing user to ADMIN: ${existing.email} (${existing.name})`);
  } else {
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password, // bcrypt hash applied by pre-save hook
      role: "ADMIN",
      isEmailVerified: true,
      isVerified: true,
      isBlocked: false,
    });
    console.log(`✅  Created new ADMIN account: ${user.email} (${user.name})`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
