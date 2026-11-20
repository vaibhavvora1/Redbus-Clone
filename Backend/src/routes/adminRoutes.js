import express from "express";
import { z } from "zod";
import {
  getAdminStats,
  // Users
  getAdminUsers,
  getAdminUserById,
  updateAdminUserBlock,
  updateAdminUserRole,
  deleteAdminUser,
  // Bookings
  getAdminBookings,
  getAdminBookingById,
  cancelAdminBooking,
  refundAdminBooking,
  deleteAdminBooking,
  // Tickets
  getAdminTickets,
  getAdminTicketById,
  // Buses
  getAdminBuses,
  getAdminBusById,
  createAdminBus,
  updateAdminBus,
  deleteAdminBus,
  // Trips
  getAdminTrips,
  getAdminTripById,
  createAdminTrip,
  updateAdminTrip,
  deleteAdminTrip,
  cancelAdminTrip,
  getAdminTripSeatMap,
  // Payments
  getAdminPayments,
  getAdminPaymentById,
  // Settings
  getAdminProfile,
  changeAdminPassword,
  // Cities
  getAdminCities,
  createAdminCity,
  updateAdminCity,
  deleteAdminCity,
  // Routes
  getAdminRoutes,
  createAdminRoute,
  updateAdminRoute,
  deleteAdminRoute,
  // Trains
  getAdminTrains,
  createAdminTrain,
  updateAdminTrain,
  deleteAdminTrain,
  // Hotels
  getAdminHotels,
  createAdminHotel,
  updateAdminHotel,
  deleteAdminHotel,
  // Operators
  getAdminOperators,
  createAdminOperator,
  updateAdminOperator,
  deleteAdminOperator,
  // Promotions
  getAdminPromotions,
  createAdminPromotion,
  updateAdminPromotion,
  deleteAdminPromotion,
} from "../controllers/adminController.js";
import {
  authenticate,
  validateObjectId,
} from "../middleware/authMiddleware.js";
import adminOnly from "../middleware/adminOnly.js";
import { bookingLimiter } from "../middleware/rateLimiter.js";
import { validateRequest } from "../middleware/validateRequest.js";

const refundSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: z.string().trim().max(500).optional(),
});

const router = express.Router();

// Enforce authentication & ADMIN role for all admin routes (401 / 403)
router.use(authenticate);
router.use(adminOnly);

// 1. Dashboard Stats
router.get("/stats", getAdminStats);
router.get("/dashboard", getAdminStats);

// 2. Users Management
router.get("/users", getAdminUsers);
router.get("/users/:id", validateObjectId("id"), getAdminUserById);
router.patch("/users/:id/block", validateObjectId("id"), updateAdminUserBlock);
router.patch("/users/:id/role", validateObjectId("id"), updateAdminUserRole);
router.delete("/users/:id", validateObjectId("id"), deleteAdminUser);

// 3. Bus Bookings
router.get("/bookings", getAdminBookings);
router.get("/bookings/:id", validateObjectId("id"), getAdminBookingById);
router.post("/bookings/:id/refund", bookingLimiter, validateObjectId("id"), validateRequest(refundSchema, "body"), refundAdminBooking);
router.patch("/bookings/:id/cancel", validateObjectId("id"), cancelAdminBooking);
router.delete("/bookings/:id", validateObjectId("id"), deleteAdminBooking);

// 4. Tickets
router.get("/tickets", getAdminTickets);
router.get("/tickets/:id", validateObjectId("id"), getAdminTicketById);
router.post("/tickets/:id/refund", bookingLimiter, validateObjectId("id"), validateRequest(refundSchema, "body"), refundAdminBooking);
router.patch("/tickets/:id/cancel", validateObjectId("id"), cancelAdminBooking);

// 5. Buses and Trips
router.get("/buses", getAdminBuses);
router.post("/buses", createAdminBus);
router.get("/buses/:id", validateObjectId("id"), getAdminBusById);
router.put("/buses/:id", validateObjectId("id"), updateAdminBus);
router.delete("/buses/:id", validateObjectId("id"), deleteAdminBus);

router.get("/trips", getAdminTrips);
router.post("/trips", createAdminTrip);
router.get("/trips/:id", validateObjectId("id"), getAdminTripById);
router.put("/trips/:id", validateObjectId("id"), updateAdminTrip);
router.patch("/trips/:id/cancel", validateObjectId("id"), cancelAdminTrip);
router.delete("/trips/:id", validateObjectId("id"), deleteAdminTrip);
router.get("/trips/:id/seat-map", validateObjectId("id"), getAdminTripSeatMap);

// 6. Payments
router.get("/payments", getAdminPayments);
router.get("/payments/:id", validateObjectId("id"), getAdminPaymentById);

// 7. Settings
router.get("/settings/profile", getAdminProfile);
router.put("/settings/change-password", changeAdminPassword);

// 8. Cities, Routes, Trains, Hotels, Operators, Promotions
router.get("/cities", getAdminCities);
router.post("/cities", createAdminCity);
router.put("/cities/:id", validateObjectId("id"), updateAdminCity);
router.delete("/cities/:id", validateObjectId("id"), deleteAdminCity);

router.get("/routes", getAdminRoutes);
router.post("/routes", createAdminRoute);
router.put("/routes/:id", validateObjectId("id"), updateAdminRoute);
router.delete("/routes/:id", validateObjectId("id"), deleteAdminRoute);

router.get("/trains", getAdminTrains);
router.post("/trains", createAdminTrain);
router.put("/trains/:id", validateObjectId("id"), updateAdminTrain);
router.delete("/trains/:id", validateObjectId("id"), deleteAdminTrain);

router.get("/hotels", getAdminHotels);
router.post("/hotels", createAdminHotel);
router.put("/hotels/:id", validateObjectId("id"), updateAdminHotel);
router.delete("/hotels/:id", validateObjectId("id"), deleteAdminHotel);

router.get("/operators", getAdminOperators);
router.post("/operators", createAdminOperator);
router.put("/operators/:id", validateObjectId("id"), updateAdminOperator);
router.delete("/operators/:id", validateObjectId("id"), deleteAdminOperator);

router.get("/promotions", getAdminPromotions);
router.post("/promotions", createAdminPromotion);
router.put("/promotions/:id", validateObjectId("id"), updateAdminPromotion);
router.delete("/promotions/:id", validateObjectId("id"), deleteAdminPromotion);

export default router;
