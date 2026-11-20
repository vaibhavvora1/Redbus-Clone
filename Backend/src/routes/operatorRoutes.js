import express from "express";
import { getOperators } from "../controllers/operatorController.js";

const router = express.Router();

router.get("/", getOperators);

export default router;
