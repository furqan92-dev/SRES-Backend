import express from "express";
import { createPaymentIntent, handlePaymentWebhook, createCheckoutSession, createSubscription } from "../controllers/payment.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/create-intent", verifyToken, createPaymentIntent);
router.post("/create-checkout-session", verifyToken, createCheckoutSession);
router.post("/create-subscription", verifyToken, createSubscription);

export default router;
