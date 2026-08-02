import dotenv from "dotenv";
import { signUpValidation, loginValidation, changePasswordValidation } from "../validations/auth.validation.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import nodemailer from "nodemailer";
import crypto from "crypto";
import GoogleStrategy from "passport-google-oauth20";
import passport from "passport";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER?.trim(),
    pass: process.env.EMAIL_PASS?.trim(),
  },
  tls: {
    rejectUnauthorized: false
  }
});

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

if (googleClientId && googleClientSecret) {
  passport.use(new GoogleStrategy.Strategy({
    clientID: googleClientId,
    clientSecret: googleClientSecret,
    callbackURL: process.env.CALLBACK_URL?.trim() || "http://localhost:8000/api/v1/auth/google/callback",
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        // Create new user if they don't exist
        const randomPassword = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            confirmPassword: hashedPassword, // Maintaining existing pattern
            credits: 0,
            totalCredits: 0
          }
        });
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
} else {
  console.warn("⚠️ Google OAuth credentials not found in environment variables. Google login strategy is disabled.");
}


const signUpController = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    console.log("SignUp Request Body:", req.body);

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
        confirmPassword: hashedPassword,
        credits: 0,
        totalCredits: 0
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
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    const sendWithBypass = async () => {
      console.log("-----------------------------------------");
      console.log(`DEV MODE OTP for ${email}: ${otp}`);
      console.log("-----------------------------------------");
      await prisma.otpVerification.upsert({
        where: { email },
        update: {
          otp: otp.toString(),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        },
        create: {
          email,
          otp: otp.toString(),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        }
      });
      const isDevMode = process.env.NODE_ENV !== 'production';
      return res.status(200).json({ 
        success: true, 
        message: isDevMode ? `OTP for ${email} is ${otp} (dev mode, email not configured)` : "OTP initialized (Check server console for code)",
        otp: isDevMode ? otp.toString() : undefined
      });
    };

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return await sendWithBypass();
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "OTP Verification",
      html: `Your OTP is <strong>${otp}</strong>. It will expire in 10 minutes.`,
    };

    try {
      await transporter.sendMail(mailOptions);
      await prisma.otpVerification.upsert({
        where: { email },
        update: {
          otp: otp.toString(),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        },
        create: {
          email,
          otp: otp.toString(),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        }
      });
      return res.status(200).json({ success: true, message: "OTP sent successfully" });
    } catch (error) {
      console.error("CRITICAL Nodemailer Error:", error);
      if (error.code === 'EAUTH') {
        console.error("AUTHENTICATION FAILED: Please check your Gmail App Password and Email User in .env");
      }
      return await sendWithBypass();
    }
  } catch (err) {
    console.error("Verify Email Controller Exception:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error during email verification",
      error: err.message
    });
  }
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
  try {
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
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
  }
}

const googleLoginController = (req, res, next) => {
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
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
    res.redirect(`http://localhost:5173/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`);
  })(req, res, next);
}

const verifyRecaptchaController = async (req, res) => {
  const { token } = req.body;

  try {
    const secretKey = process.env.GOOGLE_RECAPTCHA_SECRET_KEY?.trim();
    const isLocal = req.headers.host && (req.headers.host.includes("localhost") || req.headers.host.includes("127.0.0.1"));

    // Development bypass for localhost
    if (isLocal) {
      console.log("🔄 Dev Bypass: Bypassing Google reCAPTCHA check on localhost.");
      return res.status(200).json({ success: true, score: 0.9, message: "Dev Bypass" });
    }

    if (!token) return res.status(400).json({ success: false, message: "Token is required" });

    if (!secretKey) {
      console.error("GOOGLE_RECAPTCHA_SECRET_KEY is missing");
      return res.status(500).json({ success: false, message: "Server Error" });
    }

    const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;
    const verifyResp = await fetch(verificationURL, { method: "POST" });
    const verifyData = await verifyResp.json();

    if (verifyData.success) {
      return res.status(200).json({ success: true, score: verifyData.score || 0.9 });
    } else {
      return res.status(400).json({ success: false, message: "Verification failed" });
    }
  } catch (error) {
    console.error("ReCaptcha Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

const forgotPasswordController = async (req, res) => {
  try {
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

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Reset Your Password",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>Hi, You requested to reset your password for Smart Real Estate System.</p>
          <p>This link will expire in <b>10 minutes</b>.</p>
          <a href="${resetLink}" style="padding: 12px 24px; background-color: #50b678; color: white; text-decoration: none; border-radius: 8px; display: inline-block;">Change Password</a>
          <br/><br/>
          <p>If the button doesn't work, copy-paste this link: <br/> ${resetLink}</p>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error("Nodemailer Forgot Password Error:", error);
      return res.status(500).json({ success: false, message: "Failed to send reset link via email" });
    }

    return res.status(200).json({ success: true, message: "Password reset link sent to your email" });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
  }
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

const resetPasswordController = async (req, res) => {
  try {
    const { email, token, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    const resetEntry = await prisma.passwordReset.findUnique({ where: { email } });

    if (!resetEntry || resetEntry.token !== token || resetEntry.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }

    const { error } = changePasswordValidation.validate({ password: newPassword, confirmPassword });
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword, confirmPassword: hashedPassword }
    });

    await prisma.passwordReset.delete({ where: { email } });

    return res.status(200).json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset Password Error:", err);
  }
}

const getMeController = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        credits: true,
        totalCredits: true,
        planName: true,
        stripeCustomerId: true,
        emailRecs: true,
        emailFrequency: true,
        viewedProps: true,
        viewedFrequency: true
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, user });
  } catch (err) {
    console.error("GetMe Error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

const updateAlertsController = async (req, res) => {
  try {
    const { emailRecs, emailFrequency, viewedProps, viewedFrequency } = req.body;
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        emailRecs: typeof emailRecs === 'boolean' ? emailRecs : undefined,
        emailFrequency: emailFrequency || undefined,
        viewedProps: typeof viewedProps === 'boolean' ? viewedProps : undefined,
        viewedFrequency: viewedFrequency || undefined,
      }
    });

    return res.status(200).json({ success: true, message: "Alerts updated successfully", user: updatedUser });
  } catch (err) {
    console.error("Update Alerts Error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
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
  resetPasswordController,
  logoutController,
  getMeController,
  updateAlertsController
};