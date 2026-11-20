import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/db.js";
import { startBookingHoldCleanup } from "./jobs/bookingHoldCleanup.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend listening on port ${PORT}`);
    startBookingHoldCleanup();
  });
  server.on("error", (error) => {
    console.error(`Backend failed to listen on port ${PORT}:`, error.message);
    process.exit(1);
  });
};

startServer().catch((error) => {
  console.error("Backend startup failed:", error);
  process.exit(1);
});
