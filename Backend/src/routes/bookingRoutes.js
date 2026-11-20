import express from "express";
import {
  getBookings,
  getBookingById,
  createBooking,
  cancelBooking,
  holdSeats,
  downloadTicketPdf,
} from "../controllers/bookingController.js";
import { createTravelBooking, travelBookingSchema } from "../controllers/travelBookingController.js";
import { authenticate, optionalAuthenticate } from "../middleware/authMiddleware.js";
import { bookingLimiter } from "../middleware/rateLimiter.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = express.Router();

// GET /api/bookings — returns current user's bookings (or all if admin)
router.get("/", authenticate, getBookings);

// GET /api/bookings/:id/ticket.pdf — download real vector/text PDF ticket
router.get("/:id/ticket.pdf", authenticate, downloadTicketPdf);
router.get("/:id/ticket", authenticate, downloadTicketPdf);

// GET /api/bookings/:id — get single booking by ID
router.get("/:id", authenticate, getBookingById);

router.post("/travel", authenticate, bookingLimiter, validateRequest(travelBookingSchema, "body"), createTravelBooking);

// POST /api/bookings/hold — atomic seat hold with holdExpiresAt & idempotency
router.post("/hold", bookingLimiter, optionalAuthenticate, holdSeats);

// POST /api/bookings — create a booking reservation (strictly requires hold & payment verification)
router.post("/", bookingLimiter, optionalAuthenticate, createBooking);

// PATCH /api/bookings/:id/cancel — cancel a booking
router.patch("/:id/cancel", optionalAuthenticate, bookingLimiter, cancelBooking);

export default router;
