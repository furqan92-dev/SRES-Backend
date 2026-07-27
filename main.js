import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import authRouter from "./routes/auth.route.js";
import paymentRouter from "./routes/payment.route.js";
import creditsRouter from "./routes/credits.route.js";
import propertyRouter from "./routes/property.route.js";
import aiRouter from "./routes/ai.route.js";
import { handlePaymentWebhook } from "./controllers/payment.controller.js";
import passport from "passport";
import session from "express-session";
import helmet from "helmet";

const PORT = process.env.PORT || 8000;

const origin = {
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true,
}

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again after 15 minutes",
});  // This is for rate limiting to prevent brute force attacks, DOS, DDOS attacks, RDOS etc.

const app = express();

app.use(cors(origin));
app.use(express.json());   // for parsing json data
app.use(express.urlencoded({ extended: true }));   // for parsing form data
app.use(rateLimiter);
app.use(session({
  secret: process.env.SESSION_SECRET || "sres_session_secret_fallback_key",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/payment", paymentRouter);
app.use("/api/v1/credits", creditsRouter);
app.use("/api/v1/properties", propertyRouter);
app.use("/api/v1/ai", aiRouter);

// Stripe webhook endpoint (no rate limiting)
app.post("/api/v1/webhook/stripe", express.raw({type: 'application/json'}), handlePaymentWebhook);

const startServer = async () => {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use.`);
    } else {
      console.error("❌ Server error:", error);
    }
    process.exit(1);
  });

  server.on('close', () => {
    console.log("⚠️ Server connection closed.");
  });
};

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

startServer();
