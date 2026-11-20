import express from "express";
import {
  getTrainRun,
  getTrains,
  holdTrain,
  holdSchema,
  trainSearchSchema,
} from "../controllers/trainController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { bookingLimiter } from "../middleware/rateLimiter.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = express.Router();

router.get("/", validateRequest(trainSearchSchema), getTrains);
router.get("/:id", getTrainRun);
router.post("/hold", authenticate, bookingLimiter, validateRequest(holdSchema, "body"), holdTrain);

export default router;
