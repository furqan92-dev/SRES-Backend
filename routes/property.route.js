import express from "express";
import { createProperty, getProperties, boostProperty, featureAd } from "../controllers/property.controller.js";
import authMiddleware, { optionalAuthMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", optionalAuthMiddleware, createProperty);
router.get("/", getProperties);
router.post("/boost", optionalAuthMiddleware, boostProperty);
router.post("/feature-ad", optionalAuthMiddleware, featureAd);

export default router;
