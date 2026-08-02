import express from "express";
import {
  signUpController,
  verifyEmailController,
  verifyOTPController,
  loginController,
  googleLoginController,
  googleLoginCallbackController,
  verifyRecaptchaController,
  forgotPasswordController,
  changePasswordController,
  resetPasswordController,
  logoutController,
  getMeController,
  updateAlertsController
} from "../controllers/auth.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/sign-up", signUpController);
router.post("/verify-email", verifyEmailController);
router.post("/verify-otp", verifyOTPController);
router.post("/login", loginController);
router.get("/google", googleLoginController);
router.get("/google/callback", googleLoginCallbackController);
router.post("/verify-recaptcha", verifyRecaptchaController);
router.post("/forgot-password", forgotPasswordController);
router.post("/reset-password", resetPasswordController);
router.put("/change-password", authMiddleware, changePasswordController)
router.delete("/logout", authMiddleware, logoutController)
router.get("/me", authMiddleware, getMeController)
router.put("/me/alerts", authMiddleware, updateAlertsController)

export default router;
