/**
 * Migration script: fix legacy phone/email/googleId indexes on the users collection.
 *
 * What it does:
 *  1. Drops the old non-partial unique indexes (phone_1, email_1, googleId_1) if present.
 *  2. Unsets null / empty-string values for phone, mobile, email, googleId so they are
 *     omitted from documents entirely (the new partial indexes skip absent fields).
 *  3. Calls User.syncIndexes() to create the new partial unique indexes defined in the model.
 *
 * Safe to run multiple times — each step is idempotent.
 *
 * Usage:
 *   node Backend/scripts/fixUserIndexes.js
 *   (from the repo root, with Backend/.env present)
 */

import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/models/User.js";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("ERROR: MONGODB_URI is not set in your .env file.");
  process.exit(1);
}

async function main() {
  console.log("Connecting to MongoDB…");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected.\n");

  const collection = mongoose.connection.collection("users");

  // ── Step 1: Drop old non-partial unique indexes ───────────────────────────
  const legacyIndexes = ["phone_1", "email_1", "googleId_1"];
  for (const indexName of legacyIndexes) {
    try {
      await collection.dropIndex(indexName);
      console.log(`✅  Dropped index: ${indexName}`);
    } catch (err) {
      if (err.codeName === "IndexNotFound" || err.code === 27) {
        console.log(`ℹ️   Index not found (already gone or never created): ${indexName}`);
      } else {
        throw err;
      }
    }
  }

  console.log();

  // ── Step 2: Unset null / empty-string unique fields ───────────────────────
  const fieldsToClean = ["phone", "mobile", "email", "googleId"];
  for (const field of fieldsToClean) {
    const result = await collection.updateMany(
      { [field]: { $in: [null, ""] } },
      { $unset: { [field]: "" } }
    );
    if (result.modifiedCount > 0) {
      console.log(`✅  Unset null/empty "${field}" on ${result.modifiedCount} document(s).`);
    } else {
      console.log(`ℹ️   No null/empty "${field}" values found — nothing to clean.`);
    }
  }

  console.log();

  // ── Step 3: Build new partial unique indexes from the model definition ─────
  console.log("Synchronising indexes from User model…");
  await User.syncIndexes();
  console.log("✅  Partial indexes synchronised.\n");

  await mongoose.disconnect();
  console.log("Done. Disconnected from MongoDB.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
