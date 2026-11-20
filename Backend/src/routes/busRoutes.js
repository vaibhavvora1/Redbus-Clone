import express from "express";
import {
  getBuses,
  getBusById,
  getTripSeats,
  lockSeats,
  unlockSeats,
} from "../controllers/busController.js";
import { validateObjectId } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getBuses);
router.get("/:id", validateObjectId("id"), getBusById);
router.get("/:id/seats", validateObjectId("id"), getTripSeats);
router.post("/:id/lock-seats", validateObjectId("id"), lockSeats);
router.post("/:id/unlock-seats", validateObjectId("id"), unlockSeats);

export default router;
