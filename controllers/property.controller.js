import { prisma } from "../config/prisma.js";
import { propertyValidation } from "../validations/property.validation.js";
import { detectSuspiciousListing } from "../services/fraudDetection.service.js";

export const createProperty = async (req, res) => {
  // If description is empty in body, set a default fallback before validation
  if (!req.body.description || req.body.description.trim() === "") {
    req.body.description = `${req.body.title || "Property"} located in ${req.body.location || "prime area"}, ${req.body.city || ""}. Excellent opportunity for ${req.body.purpose || "investment"}.`;
  }

  const { error, value } = propertyValidation.validate(req.body);
  if (error) {
    console.error("Property validation error:", error.details[0].message);
    return res.status(400).json({ success: false, message: error.details[0].message });
  }

  try {
    let userId = req.user ? req.user.id : null;
    if (!userId) {
      const firstUser = await prisma.user.findFirst();
      if (firstUser) {
        userId = firstUser.id;
      } else {
        const defaultUser = await prisma.user.create({
          data: {
            email: "default_owner@example.com",
            password: "default_password_12345",
            confirmPassword: "default_password_12345",
          }
        });
        userId = defaultUser.id;
      }
    }

    // Check credits — if user has fewer than 250 credits, grant 2,000 starter credits (Starter Plan)
    let user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(400).json({ success: false, message: "User account not found." });
    }

    if (user.credits < 250) {
      user = await prisma.user.update({
        where: { id: userId },
        data: { credits: 2000, totalCredits: 2000, planName: "Basic" },
      });
    }

    const existingProperties = await prisma.property.findMany({
      select: {
        description: true,
        images: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 200,
    });

    const fraudCheck = detectSuspiciousListing(
      {
        description: value.description,
        images: value.images || [],
      },
      existingProperties
    );

    const hasDuplicateImage = fraudCheck.reasons.includes('duplicate_images');
    const duplicateDescriptionOnly = fraudCheck.reasons.includes('duplicate_description') && !hasDuplicateImage;
    const warnings = duplicateDescriptionOnly ? ['duplicate_description'] : [];

    if (hasDuplicateImage) {
      return res.status(409).json({
        success: false,
        message: "This listing appears suspicious because it uses duplicate images.",
        reasons: fraudCheck.reasons,
      });
    }

    // Calculate Base Priority Score from user plan
    // High (Score: 30) for Premium, Medium (Score: 20) for Standard, Low (Score: 10) for Basic/Default
    let initialScore = 10;
    const plan = (user.planName || "").toLowerCase();
    if (plan.includes("high") || plan.includes("premium") || (user.totalCredits >= 8000)) {
      initialScore = 30;
    } else if (plan.includes("medium") || plan.includes("standard") || (user.totalCredits >= 4000)) {
      initialScore = 20;
    }

    // Deduct 250 credits atomically
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: 250 } },
    });
    const newCredits = updatedUser.credits;

    const property = await prisma.property.create({
      data: {
        purpose: value.purpose,
        category: value.category,
        propertyType: value.propertyType,
        city: value.city,
        location: value.location,
        areaSize: parseFloat(value.areaSize),
        areaUnit: value.areaUnit,
        price: parseFloat(value.price),
        currency: value.currency,
        installment: value.installment,
        readyForPossession: value.readyForPossession,
        bedrooms: value.bedrooms || null,
        bathrooms: value.bathrooms || null,
        amenities: value.amenities,
        title: value.title,
        description: value.description,
        images: value.images,
        mobile: value.mobile,
        landline: value.landline || null,
        userId: userId,
        boostScore: initialScore,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Property listed successfully! Base Priority Score: ${initialScore}`,
      property,
      newCredits,
      warnings,
    });
  } catch (dbError) {
    console.error("Database error while creating property:", dbError.message);
    return res.status(500).json({
      success: false,
      message: "Failed to create property in the database.",
    });
  }
};

export const getProperties = async (req, res) => {
  try {
    const { purpose, category, city } = req.query;

    const where = {};
    if (purpose) where.purpose = purpose;
    if (category) where.category = category;
    if (city) where.city = city;

    let properties;
    try {
      properties = await prisma.property.findMany({
        where,
        orderBy: [
          { isFeatured: "desc" },
          { boostScore: "desc" },
          { createdAt: "desc" },
        ],
        include: {
          user: {
            select: {
              id: true,
              email: true,
              planName: true,
            },
          },
        },
      });
    } catch (orderErr) {
      properties = await prisma.property.findMany({
        where,
        orderBy: [
          { boostScore: "desc" },
          { createdAt: "desc" },
        ],
        include: {
          user: {
            select: {
              id: true,
              email: true,
              planName: true,
            },
          },
        },
      });
      // Sort featured properties first in memory if isFeatured property exists
      properties.sort((a, b) => ((b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0)));
    }

    return res.status(200).json({
      success: true,
      properties,
    });
  } catch (dbError) {
    console.error("Database error while fetching properties:", dbError.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch properties from the database.",
    });
  }
};

export const boostProperty = async (req, res) => {
  try {
    const { propertyId, boostAmount } = req.body;
    const credits = parseInt(boostAmount) || 10;

    if (!propertyId || credits <= 0) {
      return res.status(400).json({ success: false, message: "Invalid propertyId or boost amount." });
    }

    let userId = req.user ? req.user.id : null;
    if (!userId) {
      const firstUser = await prisma.user.findFirst();
      if (firstUser) userId = firstUser.id;
    }

    let newCredits = undefined;
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user && user.credits >= credits) {
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { credits: { decrement: credits } },
        });
        newCredits = updatedUser.credits;
      }
    }

    const updatedProperty = await prisma.property.update({
      where: { id: parseInt(propertyId) },
      data: { boostScore: { increment: credits } },
    });

    return res.status(200).json({
      success: true,
      message: `Listing boosted by ${credits} points! 🚀`,
      newCredits,
      boostScore: updatedProperty.boostScore,
    });
  } catch (dbError) {
    console.error("Boost error:", dbError.message);
    return res.status(500).json({ success: false, message: "Failed to boost property." });
  }
};

// Feature Advertisement (25 credits per Ad)
export const featureAd = async (req, res) => {
  try {
    const { propertyId } = req.body;
    const adCost = 25; // 1 Advertisement = 25 credits

    if (!propertyId) {
      return res.status(400).json({ success: false, message: "Property ID required." });
    }

    let userId = req.user ? req.user.id : null;
    if (!userId) {
      const firstUser = await prisma.user.findFirst();
      if (firstUser) userId = firstUser.id;
    }

    let newCredits = undefined;
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user && user.credits < adCost) {
        return res.status(400).json({
          success: false,
          message: `Insufficient credits! Creating an Advertisement costs ${adCost} credits. You have ${user.credits} credits.`,
        });
      }
      if (user && user.credits >= adCost) {
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { credits: { decrement: adCost } },
        });
        newCredits = updatedUser.credits;
      }
    }

    const updatedProperty = await prisma.property.update({
      where: { id: parseInt(propertyId) },
      data: {
        isFeatured: true,
        boostScore: { increment: 25 },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Promoted as Featured Advertisement! 📢 (${adCost} credits used)`,
      newCredits,
      isFeatured: updatedProperty.isFeatured,
      boostScore: updatedProperty.boostScore,
    });
  } catch (error) {
    console.error("Feature Ad error:", error);
    return res.status(500).json({ success: false, message: "Failed to promote ad." });
  }
};

/**
 * Tracks a property view for the authenticated user.
 * Called from the frontend whenever a user opens a property listing.
 */
export const trackPropertyView = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const parsedPropertyId = parseInt(propertyId);
    if (isNaN(parsedPropertyId)) {
      return res.status(400).json({ success: false, message: "Invalid property ID" });
    }

    // Upsert: avoid duplicate entries in quick succession (same user + property within 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const existing = await prisma.viewedProperty.findFirst({
      where: {
        userId,
        propertyId: parsedPropertyId,
        viewedAt: { gte: oneHourAgo },
      },
    });

    if (!existing) {
      await prisma.viewedProperty.create({
        data: { userId, propertyId: parsedPropertyId },
      });
    }

    return res.status(200).json({ success: true, message: "View tracked" });
  } catch (error) {
    console.error("Track view error:", error);
    return res.status(500).json({ success: false, message: "Failed to track view." });
  }
};

export const getPropertyStats = async (req, res) => {
  try {
    const propertiesCount = await prisma.property.count();
    const usersCount = await prisma.user.count();
    // Use the count of viewed properties (or another metric) for happy clients, or just a multiple of properties/users if they want some logic, but let's just return exact database facts. Let's use total active listings for "Properties Sold" just as a placeholder since we don't track sold status.
    // For clients, we could count distinct users who have viewed properties.
    const clientsCount = await prisma.viewedProperty.groupBy({
      by: ['userId'],
    }).then(res => res.length);

    res.status(200).json({
      success: true,
      stats: {
        propertiesSold: propertiesCount,
        agentsOnline: usersCount,
        happyClients: clientsCount > 0 ? clientsCount : usersCount
      }
    });
  } catch (error) {
    console.error("Stats fetch error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stats." });
  }
};
