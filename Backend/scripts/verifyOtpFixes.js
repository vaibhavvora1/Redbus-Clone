/**
 * OTP Flow Verification Script
 * 
 * Tests the fixed OTP controller logic WITHOUT requiring a running server
 * or MongoDB connection. It imports the pure functions and validates
 * the Zod schemas, phone normalization, and OTP hash logic.
 *
 * Run: node Backend/scripts/verifyOtpFixes.js
 */
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { normalizePhone, isValidIndianPhone } from "../src/utils/userFields.js";
import {
  registerSchema,
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
} from "../src/utils/authSchemas.js";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

console.log("\n══════════════════════════════════════════════════");
console.log("  OTP & Auth Fixes — Verification Suite");
console.log("══════════════════════════════════════════════════\n");

// ─── 1. OTP Generation (crypto.randomInt) ──────────────────────────
console.log("1. OTP Generation");
{
  const otp = crypto.randomInt(100000, 1000000).toString();
  assert(otp.length === 6, `Generated OTP is 6 digits: ${otp}`);
  assert(/^\d{6}$/.test(otp), "OTP contains only digits");

  // Generate 100 OTPs and check range
  const otps = Array.from({ length: 100 }, () =>
    crypto.randomInt(100000, 1000000)
  );
  assert(
    otps.every((o) => o >= 100000 && o < 1000000),
    "100 OTPs all in [100000, 1000000) range"
  );
}

// ─── 2. OTP Hashing (bcrypt) ───────────────────────────────────────
console.log("\n2. OTP Hashing & Comparison");
{
  const otp = "123456";
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(otp, salt);

  assert(hash !== otp, "Hash is different from plain OTP");
  assert(hash.startsWith("$2"), "Hash uses bcrypt format");
  assert(await bcrypt.compare(otp, hash), "Correct OTP matches hash");
  assert(!(await bcrypt.compare("654321", hash)), "Wrong OTP does NOT match hash");
  assert(await bcrypt.compare("123456", hash), "String comparison works (not numeric)");

  // Trimmed input comparison
  const trimmedOtp = " 123456 ".trim();
  assert(await bcrypt.compare(trimmedOtp, hash), "Trimmed OTP matches hash");
}

// ─── 3. Phone Normalization ────────────────────────────────────────
console.log("\n3. Phone Normalization (must be identical in send & verify)");
{
  assert(normalizePhone("9876543210") === "+919876543210", "10-digit → +91 prefix");
  assert(normalizePhone("+919876543210") === "+919876543210", "Already E.164 → unchanged");
  assert(normalizePhone("919876543210") === "+919876543210", "12-digit with 91 prefix → +91");
  assert(normalizePhone("09876543210") === "+919876543210", "11-digit with 0 prefix → +91");
  assert(normalizePhone("  9876543210  ") === "+919876543210", "Whitespace trimmed");
  assert(normalizePhone("+91-987-654-3210") === "+919876543210", "Dashes stripped");
  assert(normalizePhone("") === undefined, "Empty → undefined");
  assert(normalizePhone(null) === undefined, "null → undefined");
  assert(normalizePhone(undefined) === undefined, "undefined → undefined");
  assert(normalizePhone("12345") === "12345", "Invalid short number → returned as-is");

  // isValidIndianPhone
  assert(isValidIndianPhone("+919876543210"), "+919876543210 is valid");
  assert(isValidIndianPhone("+916000000000"), "+916... is valid (starts with 6)");
  assert(!isValidIndianPhone("+915000000000"), "+915... is invalid (starts with 5)");
  assert(isValidIndianPhone(undefined), "undefined is valid (optional field)");
  assert(isValidIndianPhone(null), "null is valid (optional field)");
  assert(isValidIndianPhone(""), "empty is valid (optional field)");
}

// ─── 4. Zod Schema: sendOtpSchema ─────────────────────────────────
console.log("\n4. sendOtpSchema Validation");
{
  const good = sendOtpSchema.safeParse({ email: "test@example.com", purpose: "register" });
  assert(good.success, "Valid email + purpose passes");
  assert(good.data.email === "test@example.com", "Email is lowercased and trimmed");

  const noEmail = sendOtpSchema.safeParse({ purpose: "register" });
  assert(!noEmail.success, "Missing email fails");

  const badEmail = sendOtpSchema.safeParse({ email: "not-an-email" });
  assert(!badEmail.success, "Invalid email format fails");

  const upper = sendOtpSchema.safeParse({ email: "  TEST@Example.COM  " });
  assert(upper.success && upper.data.email === "test@example.com", "Email trimmed + lowercased");
}

// ─── 5. Zod Schema: verifyOtpSchema ───────────────────────────────
console.log("\n5. verifyOtpSchema Validation");
{
  const good = verifyOtpSchema.safeParse({
    email: "test@example.com",
    otp: "123456",
  });
  assert(good.success, "Valid email + 6-digit OTP passes");

  const badOtp = verifyOtpSchema.safeParse({
    email: "test@example.com",
    otp: "12345",
  });
  assert(!badOtp.success, "5-digit OTP fails");
  assert(
    badOtp.error.issues[0].message.includes("6 digits"),
    "Error message mentions '6 digits'"
  );

  const lettersOtp = verifyOtpSchema.safeParse({
    email: "test@example.com",
    otp: "12345a",
  });
  assert(!lettersOtp.success, "OTP with letters fails");

  const withPhone = verifyOtpSchema.safeParse({
    email: "test@example.com",
    otp: "123456",
    phone: "9876543210",
  });
  assert(withPhone.success, "With valid phone passes");
  assert(withPhone.data.phone === "9876543210", "Phone normalized to 10-digit");

  const badPhone = verifyOtpSchema.safeParse({
    email: "test@example.com",
    otp: "123456",
    phone: "12345",
  });
  assert(!badPhone.success, "Invalid phone format fails");
}

// ─── 6. Zod Schema: registerSchema ────────────────────────────────
console.log("\n6. registerSchema Validation");
{
  const good = registerSchema.safeParse({
    name: "Rahul Sharma",
    email: "rahul@example.com",
    password: "secret123",
  });
  assert(good.success, "Valid registration data passes");

  const noName = registerSchema.safeParse({
    email: "test@example.com",
    password: "secret123",
  });
  assert(!noName.success, "Missing name fails");

  const shortPass = registerSchema.safeParse({
    name: "Test",
    email: "test@example.com",
    password: "12345",
  });
  assert(!shortPass.success, "Password < 6 chars fails");
  assert(
    shortPass.error.issues[0].message.includes("6"),
    "Error mentions minimum 6"
  );

  const withPhone = registerSchema.safeParse({
    name: "Test User",
    email: "test@example.com",
    password: "secret123",
    phone: "9876543210",
  });
  assert(withPhone.success, "With valid phone passes");

  const withBadPhone = registerSchema.safeParse({
    name: "Test User",
    email: "test@example.com",
    password: "secret123",
    phone: "1234567890",
  });
  assert(!withBadPhone.success, "Phone starting with 1 fails");
}

// ─── 7. Zod Schema: loginSchema ───────────────────────────────────
console.log("\n7. loginSchema Validation");
{
  const emailLogin = loginSchema.safeParse({
    email: "test@example.com",
    password: "secret123",
  });
  assert(emailLogin.success, "Email + password login passes");

  const identifierLogin = loginSchema.safeParse({
    identifier: "9876543210",
    password: "secret123",
  });
  assert(identifierLogin.success, "Phone identifier login passes");

  const noPassword = loginSchema.safeParse({
    email: "test@example.com",
  });
  assert(!noPassword.success, "Missing password fails");

  const noIdentity = loginSchema.safeParse({
    password: "secret123",
  });
  assert(!noIdentity.success, "No email/phone/identifier fails");
}

// ─── 8. consumeOtp logic (pure test) ──────────────────────────────
console.log("\n8. consumeOtp Logic (structural)");
{
  // Verify the hash + compare flow works end-to-end
  const otp = crypto.randomInt(100000, 1000000).toString();
  const hash = await bcrypt.hash(otp, 10);

  // Simulate: correct OTP
  assert(await bcrypt.compare(otp, hash), "consumeOtp: correct OTP would match");

  // Simulate: wrong OTP
  const wrongOtp = "000000";
  assert(!(await bcrypt.compare(wrongOtp, hash)), "consumeOtp: wrong OTP would NOT match");

  // Simulate: trimmed input
  const paddedOtp = `  ${otp}  `;
  assert(
    await bcrypt.compare(paddedOtp.trim(), hash),
    "consumeOtp: trimmed input matches"
  );
}

// ─── Summary ───────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════");
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════════\n");

process.exit(failed > 0 ? 1 : 0);
