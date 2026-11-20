import express from "express";
import { getGovernmentBuses } from "../controllers/governmentBusController.js";

const router = express.Router();
router.get("/", getGovernmentBuses);
export default router;
