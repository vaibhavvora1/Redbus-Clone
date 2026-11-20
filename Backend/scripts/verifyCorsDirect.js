import { EventEmitter } from "node:events";
import app from "../src/app.js";

function testPreflight(origin, path = "/api/auth/login") {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = "OPTIONS";
    req.url = path;
    req.originalUrl = path;
    req.headers = {
      origin: origin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "Content-Type, Authorization, Idempotency-Key",
    };
    req.query = {};
    req.params = {};
    req.socket = new EventEmitter();

    const res = new EventEmitter();
    res.headers = {};
    res.statusCode = 200;
    res.setHeader = (key, val) => {
      res.headers[key.toLowerCase()] = val;
    };
    res.getHeader = (key) => res.headers[key.toLowerCase()];
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.end = (chunk) => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: chunk,
      });
    };
    res.send = (chunk) => res.end(chunk);
    res.json = (data) => res.end(JSON.stringify(data));

    app(req, res);
  });
}

async function run() {
  console.log("=== IN-PROCESS CORS PREFLIGHT VERIFICATION ===");
  const test1 = await testPreflight("http://localhost:5173", "/api/auth/login");
  console.log("Origin: http://localhost:5173 -> /api/auth/login");
  console.log("Status:", test1.statusCode);
  console.log("CORS Origin:", test1.headers["access-control-allow-origin"]);
  console.log("Credentials:", test1.headers["access-control-allow-credentials"]);
  console.log("Methods:", test1.headers["access-control-allow-methods"]);
  console.log("Headers:", test1.headers["access-control-allow-headers"]);

  console.log("\nOrigin: http://localhost:5174 -> /api/auth/login");
  const test2 = await testPreflight("http://localhost:5174", "/api/auth/login");
  console.log("Status:", test2.statusCode);
  console.log("CORS Origin:", test2.headers["access-control-allow-origin"]);
  console.log("Credentials:", test2.headers["access-control-allow-credentials"]);
  console.log("Methods:", test2.headers["access-control-allow-methods"]);
  console.log("Headers:", test2.headers["access-control-allow-headers"]);

  console.log("\nOrigin: http://evil.com -> /api/auth/login");
  const test3 = await testPreflight("http://evil.com", "/api/auth/login");
  console.log("Status:", test3.statusCode);
  console.log("CORS Origin:", test3.headers["access-control-allow-origin"] || "BLOCKED / NONE");

  console.log("\nOrigin: http://localhost:5173 -> /api/bookings");
  const test4 = await testPreflight("http://localhost:5173", "/api/bookings");
  console.log("Status:", test4.statusCode);
  console.log("CORS Origin:", test4.headers["access-control-allow-origin"]);
  console.log("Credentials:", test4.headers["access-control-allow-credentials"]);
  console.log("Methods:", test4.headers["access-control-allow-methods"]);
  console.log("Headers:", test4.headers["access-control-allow-headers"]);

  console.log("\nOrigin: http://localhost:5174 -> /api/bookings");
  const test5 = await testPreflight("http://localhost:5174", "/api/bookings");
  console.log("Status:", test5.statusCode);
  console.log("CORS Origin:", test5.headers["access-control-allow-origin"]);
  console.log("Credentials:", test5.headers["access-control-allow-credentials"]);

  console.log("\nOrigin: http://malicious.org -> /api/bookings");
  const test6 = await testPreflight("http://malicious.org", "/api/bookings");
  console.log("Status:", test6.statusCode);
  console.log("CORS Origin:", test6.headers["access-control-allow-origin"] || "BLOCKED / NONE");
}

run().catch(console.error);
