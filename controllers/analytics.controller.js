import { prisma } from "../config/prisma.js";

export const trackEvent = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { eventType } = req.body;
    
    if (!eventType) {
      return res.status(400).json({ success: false, message: "eventType is required" });
    }

    const parsedPropertyId = parseInt(propertyId, 10);
    if (isNaN(parsedPropertyId)) {
      return res.status(400).json({ success: false, message: "Invalid property ID" });
    }

    await prisma.propertyAnalytics.create({
      data: {
        propertyId: parsedPropertyId,
        eventType: eventType.toUpperCase(),
      }
    });

    return res.status(200).json({ success: true, message: "Event tracked" });
  } catch (error) {
    console.error("Track event error:", error);
    return res.status(500).json({ success: false, message: "Failed to track event" });
  }
};

export const getMyAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { range } = req.query; // '7', '30', '90'

    // Get all properties owned by this user
    const userProperties = await prisma.property.findMany({
      where: { userId },
      select: { id: true }
    });

    const propertyIds = userProperties.map(p => p.id);

    if (propertyIds.length === 0) {
      return res.status(200).json({
        success: true,
        analytics: {
          views: { values: Array(12).fill(0) },
          clicks: { values: Array(12).fill(0) },
          leads: { values: Array(12).fill(0) },
          calls: { values: Array(12).fill(0) },
          whatsapp: { values: Array(12).fill(0) },
          sms: { values: Array(12).fill(0) },
          emails: { values: Array(12).fill(0) }
        }
      });
    }

    // Determine the start date based on range
    const isMonths = range === '90';
    const numPeriods = 12;
    const now = new Date();
    
    const startDate = new Date();
    if (isMonths) {
      startDate.setMonth(now.getMonth() - numPeriods);
    } else {
      startDate.setDate(now.getDate() - (numPeriods * 7));
    }

    const events = await prisma.propertyAnalytics.findMany({
      where: {
        propertyId: { in: propertyIds },
        createdAt: { gte: startDate }
      }
    });

    const initValues = () => Array(12).fill(0);
    const data = {
      views: initValues(),
      clicks: initValues(),
      leads: initValues(),
      calls: initValues(),
      whatsapp: initValues(),
      sms: initValues(),
      emails: initValues()
    };

    const getBucketIndex = (date) => {
      if (isMonths) {
        const diffMonths = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
        return 11 - diffMonths;
      } else {
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const diffWeeks = Math.floor(diffDays / 7);
        return 11 - diffWeeks;
      }
    };

    events.forEach(event => {
      const idx = getBucketIndex(event.createdAt);
      if (idx >= 0 && idx < 12) {
        const type = event.eventType.toLowerCase();
        if (data[type]) {
          data[type][idx]++;
        } else if (type === 'view') {
           data.views[idx]++;
        } else if (type === 'click') {
           data.clicks[idx]++;
        } else if (type === 'lead') {
           data.leads[idx]++;
        } else if (type === 'call') {
           data.calls[idx]++;
        } else if (type === 'whatsapp') {
           data.whatsapp[idx]++;
        } else if (type === 'sms') {
           data.sms[idx]++;
        } else if (type === 'email') {
           data.emails[idx]++;
        }
      }
    });
    
    const viewedProperties = await prisma.viewedProperty.findMany({
      where: {
        propertyId: { in: propertyIds },
        viewedAt: { gte: startDate }
      }
    });
    
    viewedProperties.forEach(event => {
      const idx = getBucketIndex(event.viewedAt);
      if (idx >= 0 && idx < 12) {
        data.views[idx]++;
      }
    });

    return res.status(200).json({
      success: true,
      analytics: {
        views: { values: data.views },
        clicks: { values: data.clicks },
        leads: { values: data.leads },
        calls: { values: data.calls },
        whatsapp: { values: data.whatsapp },
        sms: { values: data.sms },
        emails: { values: data.emails }
      }
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    return res.status(500).json({ success: false, message: "Failed to get analytics" });
  }
};
