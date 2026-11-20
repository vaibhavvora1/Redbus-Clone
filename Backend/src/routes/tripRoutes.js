import express from "express";
import { getTripDetail } from "../controllers/governmentBusController.js";
import { validateObjectId } from "../middleware/authMiddleware.js";

const router = express.Router();
router.get("/:tripId", validateObjectId("tripId"), getTripDetail);
export default router;
