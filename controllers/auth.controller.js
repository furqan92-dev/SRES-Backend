import dotenv from "dotenv";
import { signUpValidation, loginValidation, changePasswordValidation } from "../validations/auth.validation.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { Resend } from "resend";
import crypto from "crypto";
import GoogleStrategy from "passport-google-oauth20";
import passport from "passport";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

passport.use(new GoogleStrategy.Strategy({
  clientID: process.env.GOOGLE_CLIENT_ID?.trim(),
  clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim(),
  callbackURL: process.env.CALLBACK_URL?.trim(),
}, async (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

const signUpController = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Password is not equal to Confirm Password" });
    }

    const { error, value } = signUpValidation.validate(req.body);

    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { email } = value;

    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      return res.status(400).json({ success: false, message: "User with this email already exists" });
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        confirmPassword: hashedPassword
      }
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return res.status(201).json({ success: true, message: "SignUp Successful", user, token });
  } catch (err) {
    console.error("SignUp Error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
  }
}

const verifyEmailController = async (req, res) => {
  const { email } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000);

  await resend.emails.send({
    from: "muhammadfurqancheema92@gmail.com",
    to: email,
    subject: "OTP Verification",
    html: `Your OTP is ${otp}`,
  });

  await prisma.otpVerification.create({
    update: {
      otp: otp.toString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    },
    data: {
      email,
      otp: otp.toString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });

  return res.status(200).json({ success: true, message: "Verify Successful" });
}

const verifyOTPController = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const otpVerification = await prisma.otpVerification.findUnique({ where: { email } });
    if (!otpVerification) {
      return res.status(400).json({ success: false, message: "OTP not found" });
    }

    if (otpVerification.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (otpVerification.expiresAt < new Date()) {
      await prisma.otpVerification.delete({ where: { email } });
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }

    await prisma.otpVerification.delete({ where: { email } });

    return res.status(200).json({ success: true, message: "Email verified successfully" });
  } catch (err) {
    console.error("Verify OTP Error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
  }
}

const loginController = async (req, res) => {
  const { error, value } = loginValidation.validate(req.body);

  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { email, password } = value;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(400).json({ success: false, message: "User not found" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(400).json({ success: false, message: "Invalid password" });
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

  return res.status(200).json({ success: true, message: "Login Successful", user, token });
}

const googleLoginController = (req, res, next) => {
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })(req, res, next);
};

const googleLoginCallbackController = (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user) => {
    if (err) {
      console.error("Google Login Callback Error:", err);
      return res.redirect(`http://localhost:5173/login?error=${encodeURIComponent(err.message)}`);
    }
    if (!user) {
      console.error("Google Login Callback Error: User not found");
      return res.redirect('http://localhost:5173/login?error=User not found');
    }
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.redirect(`http://localhost:5173/auth/callback?token=${token}`);
  })(req, res, next);
}

const verifyRecaptchaController = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: "Token is required" });
  }

  try {
    const secretKey = process.env.GOOGLE_RECAPTCHA_SECRET_KEY;

    if (!secretKey) {
      console.error("GOOGLE_RECAPTCHA_SECRET_KEY is missing in .env");
      return res.status(500).json({ success: false, message: "Server Misconfiguration" });
    }

    const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

    const response = await fetch(verificationURL, { method: "POST" });
    const data = await response.json();

    if (data.success) {
      return res.status(200).json({ success: true, message: "ReCaptcha Verified" });
    } else {
      return res.status(400).json({ success: false, message: "ReCaptcha Verification Failed", errors: data["error-codes"] });
    }
  } catch (error) {
    console.error("ReCaptcha Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

const forgotPasswordController = async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(400).json({ success: false, message: "User not found" });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.passwordReset.upsert({
    where: { email },
    update: { token, expiresAt },
    create: { email, token, expiresAt }
  });

  const resetLink = `http://localhost:5173/change-password?token=${token}&email=${email}`;

  await resend.emails.send({
    from: "muhammadfurqancheema92@gmail.com",
    to: email,
    subject: "Reset Your Password",
    html: `
        <h1>Password Reset Request</h1>
        <p>Hi, You requested to reset your password for Smart Real Estate System.</p>
        <p>This link will expire in <b>10 minutes</b>.</p>
        <a href="${resetLink}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Change Password</a>
        <br/><br/>
        <p>If the button doesn't work, copy-paste this link: ${resetLink}</p>
      `
  });

  return res.status(200).json({ success: true, message: "Password reset link sent to your email" });
}

const changePasswordController = async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "New Password and Confirm Password do not match" });
  }

  const { error, value } = changePasswordValidation.validate({ password: newPassword, confirmPassword });

  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { email } = req.user;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(400).json({ success: false, message: "User not found" });
  }

  const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
  if (!isPasswordValid) {
    return res.status(400).json({ success: false, message: "Invalid password" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const updatedUser = await prisma.user.update({
    where: { email },
    data: { password: hashedPassword, confirmPassword: hashedPassword }
  });

  return res.status(200).json({ success: true, message: "Change Password Successful", updatedUser });
}

const logoutController = async (req, res) => {
  const { email } = req.user;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(400).json({ success: false, message: "User not found" });
  }

  await prisma.user.delete({ where: { email } });

  return res.status(200).json({ success: true, message: "Logout Successful" });
}

export {
  signUpController,
  verifyEmailController,
  verifyOTPController,
  loginController,
  googleLoginController,
  googleLoginCallbackController,
  verifyRecaptchaController,
  forgotPasswordController,
  changePasswordController,
  logoutController
};