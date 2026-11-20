import { cleanupExpiredBookingHolds } from "../services/bookingHoldService.js";

const CLEANUP_INTERVAL_MS = 60 * 1000;

export function startBookingHoldCleanup() {
  const runCleanup = async () => {
    try {
      const released = await cleanupExpiredBookingHolds();
      if (released) console.info(`Released ${released} expired travel booking hold(s).`);
    } catch (error) {
      console.error("Travel hold cleanup failed:", error);
    }
  };

  void runCleanup();
  const timer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
  timer.unref();
  return timer;
}
