import { prisma } from "../config/prisma.js";
import { sendRecommendationEmail, sendViewedPropertiesEmail } from "./alertEmail.service.js";

/**
 * Determines if an alert should fire given the user's frequency setting
 * and the last time an email was sent.
 * @param {string} frequency
 * @param {Date|null} lastSentAt
 * @returns {boolean}
 */
const shouldSendEmail = (frequency, lastSentAt) => {
  if (!lastSentAt) return true; // Never sent before → send now

  const now = new Date();
  const hoursSince = (now - new Date(lastSentAt)) / (1000 * 60 * 60);

  switch (frequency) {
    case "Twice a day":    return hoursSince >= 12;
    case "Daily":          return hoursSince >= 24;
    case "Every two days": return hoursSince >= 48;
    case "Every three days": return hoursSince >= 72;
    case "Weekly":         return hoursSince >= 168;
    case "Auto":
    default:               return hoursSince >= 24; // Auto = once a day
  }
};

/**
 * Runs the alert scheduler — processes all users and sends emails as needed.
 */
export const runAlertScheduler = async () => {
  console.log("⏰ Running alert scheduler...");

  try {
    // Fetch all users that have at least one alert enabled
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { emailRecs: true },
          { viewedProps: true },
        ],
      },
    });

    if (users.length === 0) {
      console.log("ℹ️  No users with alerts enabled.");
      return;
    }

    // Fetch latest properties for recommendations
    const latestProperties = await prisma.property.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    for (const user of users) {
      // ── Email Recommendations ──────────────────────────────────
      if (user.emailRecs && process.env.EMAIL_USER) {
        if (shouldSendEmail(user.emailFrequency, user.lastEmailSentAt)) {
          try {
            await sendRecommendationEmail(user.email, latestProperties);
            await prisma.user.update({
              where: { id: user.id },
              data: { lastEmailSentAt: new Date() },
            });
          } catch (err) {
            console.error(`❌ Failed to send recommendation email to ${user.email}:`, err.message);
          }
        }
      }

      // ── Viewed Properties Digest ───────────────────────────────
      if (user.viewedProps && process.env.EMAIL_USER) {
        if (shouldSendEmail(user.viewedFrequency, user.lastViewedEmailSentAt)) {
          try {
            // Fetch the user's recently viewed properties
            const viewedEntries = await prisma.viewedProperty.findMany({
              where: { userId: user.id },
              orderBy: { viewedAt: "desc" },
              take: 5,
              include: {
                property: true,
              },
            });

            if (viewedEntries.length > 0) {
              await sendViewedPropertiesEmail(user.email, viewedEntries);
              await prisma.user.update({
                where: { id: user.id },
                data: { lastViewedEmailSentAt: new Date() },
              });
            }
          } catch (err) {
            console.error(`❌ Failed to send viewed digest to ${user.email}:`, err.message);
          }
        }
      }
    }

    console.log("✅ Alert scheduler run complete.");
  } catch (err) {
    console.error("❌ Alert scheduler error:", err);
  }
};

/**
 * Starts the alert scheduler to run every hour.
 */
export const startAlertScheduler = () => {
  console.log("🔔 Alert scheduler started (runs every hour).");

  // Run immediately on startup
  runAlertScheduler();

  // Then run every hour (3600000 ms)
  setInterval(runAlertScheduler, 60 * 60 * 1000);
};
