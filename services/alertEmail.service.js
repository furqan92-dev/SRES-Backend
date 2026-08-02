import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER?.trim(),
    pass: process.env.EMAIL_PASS?.trim(),
  },
  tls: { rejectUnauthorized: false },
});

/**
 * Sends a property recommendation email to a user.
 * @param {string} toEmail - Recipient email address
 * @param {Array} properties - Array of property objects to recommend
 */
export const sendRecommendationEmail = async (toEmail, properties) => {
  const propertyCards = properties
    .slice(0, 5)
    .map(
      (p) => `
    <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="padding:20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <h3 style="margin:0;font-size:16px;color:#0f172a;font-weight:700;">${p.title}</h3>
          <span style="background:#ecfdf5;color:#059669;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;">
            ${p.purpose}
          </span>
        </div>
        <p style="margin:0 0 8px;color:#64748b;font-size:14px;">📍 ${p.location}, ${p.city}</p>
        <p style="margin:0 0 12px;color:#64748b;font-size:13px;">
          ${p.areaSize} ${p.areaUnit}
          ${p.bedrooms ? ` • 🛏 ${p.bedrooms} Bed` : ""}
          ${p.bathrooms ? ` • 🚿 ${p.bathrooms} Bath` : ""}
        </p>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:18px;font-weight:800;color:#059669;">
            ${p.currency} ${Number(p.price).toLocaleString()}
          </span>
          <a href="http://localhost:5173" style="background:#059669;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">
            View Property →
          </a>
        </div>
      </div>
    </div>
  `
    )
    .join("");

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:40px 20px;">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#059669,#10b981);border-radius:16px;padding:40px;text-align:center;margin-bottom:30px;">
        <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;">🏠 Smart Real Estate</h1>
        <p style="margin:12px 0 0;color:rgba(255,255,255,0.85);font-size:16px;">Your personalized property recommendations</p>
      </div>

      <!-- Body -->
      <div style="background:#fff;border-radius:16px;padding:30px;margin-bottom:24px;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
        <h2 style="margin:0 0 6px;color:#0f172a;font-size:20px;">Fresh Listings Just For You 🎯</h2>
        <p style="margin:0 0 24px;color:#64748b;font-size:14px;">Based on your preferences, here are the latest properties we think you'll love:</p>
        ${propertyCards}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:30px;">
        <a href="http://localhost:5173" style="background:linear-gradient(135deg,#059669,#10b981);color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:700;display:inline-block;">
          Explore All Properties →
        </a>
      </div>

      <!-- Footer -->
      <div style="text-align:center;color:#94a3b8;font-size:12px;">
        <p style="margin:0;">You're receiving this because you enabled Email Recommendations in your alert settings.</p>
        <p style="margin:8px 0 0;">Smart Real Estate System &bull; <a href="http://localhost:5173" style="color:#059669;text-decoration:none;">Manage Alerts</a></p>
      </div>

    </div>
  </body>
  </html>`;

  await transporter.sendMail({
    from: `"Smart Real Estate 🏠" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "🏠 New Property Recommendations Just For You!",
    html,
  });

  console.log(`✅ Recommendation email sent to ${toEmail}`);
};

/**
 * Sends a viewed properties digest email to a user.
 * @param {string} toEmail - Recipient email address
 * @param {Array} viewedProperties - Array of viewed property objects
 */
export const sendViewedPropertiesEmail = async (toEmail, viewedProperties) => {
  const propertyCards = viewedProperties
    .slice(0, 5)
    .map(
      (vp) => `
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <h3 style="margin:0;font-size:15px;color:#0f172a;font-weight:700;">${vp.property?.title || "Property"}</h3>
        <span style="background:#eff6ff;color:#3b82f6;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;">
          Viewed
        </span>
      </div>
      <p style="margin:0 0 8px;color:#64748b;font-size:13px;">📍 ${vp.property?.location || ""}, ${vp.property?.city || ""}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:16px;font-weight:700;color:#059669;">
          ${vp.property?.currency || "PKR"} ${Number(vp.property?.price || 0).toLocaleString()}
        </span>
        <a href="http://localhost:5173" style="background:#3b82f6;color:#fff;padding:6px 14px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600;">
          View Again →
        </a>
      </div>
    </div>
  `
    )
    .join("");

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:40px 20px;">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);border-radius:16px;padding:40px;text-align:center;margin-bottom:30px;">
        <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;">🏠 Smart Real Estate</h1>
        <p style="margin:12px 0 0;color:rgba(255,255,255,0.85);font-size:16px;">Properties you recently viewed</p>
      </div>

      <!-- Body -->
      <div style="background:#fff;border-radius:16px;padding:30px;margin-bottom:24px;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
        <h2 style="margin:0 0 6px;color:#0f172a;font-size:20px;">Your Viewed Properties 👁️</h2>
        <p style="margin:0 0 24px;color:#64748b;font-size:14px;">Here's a digest of properties you've been looking at. Don't miss out!</p>
        ${propertyCards}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:30px;">
        <a href="http://localhost:5173" style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:700;display:inline-block;">
          Continue Browsing →
        </a>
      </div>

      <!-- Footer -->
      <div style="text-align:center;color:#94a3b8;font-size:12px;">
        <p style="margin:0;">You're receiving this because you enabled Viewed Properties alerts.</p>
        <p style="margin:8px 0 0;">Smart Real Estate System &bull; <a href="http://localhost:5173" style="color:#3b82f6;text-decoration:none;">Manage Alerts</a></p>
      </div>

    </div>
  </body>
  </html>`;

  await transporter.sendMail({
    from: `"Smart Real Estate 🏠" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "👁️ Your Viewed Properties Digest",
    html,
  });

  console.log(`✅ Viewed properties digest sent to ${toEmail}`);
};
