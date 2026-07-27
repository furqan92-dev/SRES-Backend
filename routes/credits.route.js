import express from "express";
import { getAllUsers, shareCredits, trackCall } from "../controllers/credits.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import { optionalAuthMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/users", authMiddleware, getAllUsers);
router.post("/share", authMiddleware, shareCredits);
router.post("/track-call", optionalAuthMiddleware, trackCall);

export default router;
