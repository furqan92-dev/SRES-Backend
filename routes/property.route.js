import express from "express";
import { createProperty, getProperties, boostProperty, featureAd, trackPropertyView, getPropertyStats } from "../controllers/property.controller.js";
import { trackEvent, getMyAnalytics } from "../controllers/analytics.controller.js";
import authMiddleware, { optionalAuthMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/stats", getPropertyStats);
router.post("/", optionalAuthMiddleware, createProperty);
router.get("/", getProperties);
router.post("/boost", optionalAuthMiddleware, boostProperty);
router.post("/feature-ad", optionalAuthMiddleware, featureAd);
router.post("/:propertyId/view", authMiddleware, trackPropertyView);
router.post("/:propertyId/analytics", authMiddleware, trackEvent);
router.get("/my-analytics", authMiddleware, getMyAnalytics);

export default router;
