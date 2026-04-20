import express from "express";
import { getAllUsers, shareCredits } from "../controllers/credits.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/users", authMiddleware, getAllUsers);
router.post("/share", authMiddleware, shareCredits);

export default router;
