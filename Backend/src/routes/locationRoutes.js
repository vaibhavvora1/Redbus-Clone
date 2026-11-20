import express from "express";
import { getCities, getPlaces, getStations } from "../controllers/locationController.js";

const router = express.Router();

router.get("/cities", getCities);
router.get("/stations", getStations);
router.get("/places", getPlaces);

export default router;
