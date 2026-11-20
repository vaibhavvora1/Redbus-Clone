import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

import app from "../src/app.js";

async function runCorsVerification() {
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(5005, "127.0.0.1", resolve));
  const baseUrl = "http://127.0.0.1:5005";

  console.log("==========================================================");
  console.log("🧪 VERIFYING CORS PREFLIGHT & ACCESS CONTROL HEADERS");
  console.log("==========================================================\n");

  const testCases = [
    {
      name: "1. Allowed Origin 5173 -> /api/auth/login",
      url: `${baseUrl}/api/auth/login`,
      origin: "http://localhost:5173",
      method: "POST",
    },
    {
      name: "2. Allowed Origin 5174 -> /api/auth/login",
      url: `${baseUrl}/api/auth/login`,
      origin: "http://localhost:5174",
      method: "POST",
    },
    {
      name: "3. Disallowed Origin (evil.com) -> /api/auth/login",
      url: `${baseUrl}/api/auth/login`,
      origin: "http://evil.com",
      method: "POST",
    },
    {
      name: "4. Allowed Origin 5173 -> /api/bookings",
      url: `${baseUrl}/api/bookings`,
      origin: "http://localhost:5173",
      method: "POST",
    },
    {
      name: "5. Allowed Origin 5174 -> /api/bookings",
      url: `${baseUrl}/api/bookings`,
      origin: "http://localhost:5174",
      method: "POST",
    },
    {
      name: "6. Disallowed Origin (malicious.org) -> /api/bookings",
      url: `${baseUrl}/api/bookings`,
      origin: "http://malicious.org",
      method: "POST",
    },
  ];

  for (const tc of testCases) {
    console.log(`--- ${tc.name} ---`);
    try {
      const res = await fetch(tc.url, {
        method: "OPTIONS",
        headers: {
          Origin: tc.origin,
          "Access-Control-Request-Method": tc.method,
          "Access-Control-Request-Headers": "Content-Type, Authorization, Idempotency-Key",
        },
      });

      console.log(`HTTP Status:                      ${res.status} ${res.statusText}`);
      console.log(`access-control-allow-origin:      ${res.headers.get("access-control-allow-origin") || "NONE (Blocked)"}`);
      console.log(`access-control-allow-credentials: ${res.headers.get("access-control-allow-credentials") || "NONE"}`);
      console.log(`access-control-allow-methods:     ${res.headers.get("access-control-allow-methods") || "NONE"}`);
      console.log(`access-control-allow-headers:     ${res.headers.get("access-control-allow-headers") || "NONE"}`);
      console.log(`vary:                             ${res.headers.get("vary") || "NONE"}`);
    } catch (err) {
      console.log(`Request Error: ${err.message}`, err.cause || "");
    }
    console.log("");
  }

  server.close();
  console.log("✅ Verification server closed.");
}

runCorsVerification().catch((err) => {
  console.error(err);
  process.exit(1);
});
