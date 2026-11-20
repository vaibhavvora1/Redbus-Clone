import express from "express";
import {
  getHotelById,
  getHotels,
  holdHotelRoom,
  holdSchema,
  hotelSearchSchema,
} from "../controllers/hotelController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { bookingLimiter } from "../middleware/rateLimiter.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = express.Router();

router.get("/", validateRequest(hotelSearchSchema), getHotels);
router.get("/:id", validateRequest(hotelSearchSchema), getHotelById);
router.post("/hold", authenticate, bookingLimiter, validateRequest(holdSchema, "body"), holdHotelRoom);

export default router;
