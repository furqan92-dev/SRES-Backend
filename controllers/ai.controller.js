// ======================================================
// AI Property Price Estimator - Backend Service
// Uses Pakistan real estate market data heuristics
// to produce intelligent price range estimates
// ======================================================

// Base price per Marla (PKR) by city & area tier
const CITY_BASE_PRICES = {
  Islamabad: {
    default: 18000000,
    areas: {
      "F-7": 55000000, "F-6": 60000000, "F-8": 45000000,
      "F-10": 30000000, "F-11": 28000000, "G-13": 22000000,
      "G-14": 20000000, "DHA Phase 1": 35000000, "DHA Phase 2": 30000000,
      "Bahria Town": 12000000, "Gulberg": 15000000,
    }
  },
  Lahore: {
    default: 9000000,
    areas: {
      "DHA Phase 6": 22000000, "DHA Phase 5": 18000000,
      "DHA Phase 4": 15000000, "DHA Phase 1": 12000000,
      "Gulberg": 14000000, "Model Town": 11000000,
      "Bahria Town": 7500000, "Johar Town": 8000000,
      "Garden Town": 10000000, "Valencia": 9000000,
      "WAPDA Town": 6000000, "LDA Avenue": 5500000,
    }
  },
  Karachi: {
    default: 8000000,
    areas: {
      "DHA Phase 8": 20000000, "DHA Phase 6": 16000000,
      "DHA Phase 5": 14000000, "Clifton": 18000000,
      "PECHS": 9000000, "North Nazimabad": 6000000,
      "Gulshan": 7000000, "Bahria Town": 6500000,
      "Malir": 3500000, "Korangi": 3000000,
    }
  },
  Rawalpindi: {
    default: 6500000,
    areas: {
      "Bahria Town Phase 7": 9000000, "DHA": 10000000,
      "Gulraiz": 5000000, "Satellite Town": 5500000,
      "PWD": 4500000, "Askari": 7000000,
    }
  },
  Peshawar: {
    default: 4000000,
    areas: {
      "Hayatabad": 6000000, "University Town": 5500000,
      "Phase 4": 4500000, "Gulbahar": 3500000,
    }
  },
  Multan: {
    default: 3500000,
    areas: {
      "DHA": 7000000, "Bahria Town": 5000000,
      "Model Town": 4000000, "Gulgasht": 3500000,
    }
  },
  Faisalabad: {
    default: 3200000,
    areas: {
      "DHA": 6000000, "Jinnah Colony": 3000000,
      "Gulberg": 4000000, "Susan Road": 3500000,
    }
  },
  Quetta: {
    default: 2500000,
    areas: {
      "Satellite Town": 3500000, "Model Town": 3000000,
      "Jinnah Town": 2800000,
    }
  }
};

// Multipliers by property type
const TYPE_MULTIPLIERS = {
  "House": 1.0,
  "Flat": 0.85,
  "Upper Portion": 0.65,
  "Lower Portion": 0.6,
  "Farm House": 1.4,
  "Room": 0.35,
  "Penthouse": 1.5,
  "Residential Plot": 0.7,
  "Commercial Plot": 1.6,
  "Agricultural Land": 0.3,
  "Industrial Land": 1.2,
  "Plot File": 0.5,
  "Plot Form": 0.45,
  "Office": 1.3,
  "Shop": 1.2,
  "Warehouse": 0.9,
  "Factory": 1.1,
  "Building": 1.0,
  "Hotel / Guest House": 1.4,
};

// Bedroom-count multipliers
const BEDROOM_MULTIPLIERS = {
  "Studio": 0.7, "1": 0.8, "2": 0.9, "3": 1.0,
  "4": 1.15, "5": 1.3, "6": 1.5, "7": 1.65,
  "8": 1.8, "9": 1.9, "10": 2.0, "10+": 2.2,
};

// Area unit conversion to Marla
const TO_MARLA = {
  "Marla": 1,
  "Kanal": 20,
  "Sq. Ft.": 1 / 272.25,
  "Sq. Yd.": 1 / 30.25,
};

// Trend modifiers for key macro signals (+/- %)
const MARKET_TREND = {
  rental_yield: 0.045, // 4.5% average
  annual_appreciation: 0.12, // 12% annual
};

// Helper: Find best matching area
const findAreaMatch = (locationInput, cityAreas) => {
  const loc = (locationInput || "").toLowerCase();
  let bestMatch = null;
  let bestScore = 0;
  for (const area of Object.keys(cityAreas)) {
    const areaLower = area.toLowerCase();
    if (loc.includes(areaLower) || areaLower.includes(loc)) {
      if (area.length > bestScore) {
        bestScore = area.length;
        bestMatch = area;
      }
    }
  }
  return bestMatch;
};

export const estimatePropertyPrice = (req, res) => {
  try {
    const { city, location, propertyType, areaSize, areaUnit, bedrooms, purpose } = req.body;

    if (!city || !areaSize || !areaUnit) {
      return res.status(400).json({
        success: false,
        message: "city, areaSize, and areaUnit are required for estimation"
      });
    }

    // 1. Get city base price
    const cityData = CITY_BASE_PRICES[city];
    if (!cityData) {
      return res.status(400).json({ success: false, message: `City '${city}' not supported for estimation` });
    }

    // 2. Find area-level price or use city default
    let basePricePerMarla = cityData.default;
    const areaMatch = findAreaMatch(location, cityData.areas);
    if (areaMatch) {
      basePricePerMarla = cityData.areas[areaMatch];
    }

    // 3. Convert area to Marla
    const conversionFactor = TO_MARLA[areaUnit] || 1;
    const areaInMarla = parseFloat(areaSize) * conversionFactor;

    // 4. Property type multiplier
    const typeMultiplier = TYPE_MULTIPLIERS[propertyType] || 1.0;

    // 5. Bedroom multiplier
    const bedroomMultiplier = BEDROOM_MULTIPLIERS[bedrooms] || 1.0;

    // 6. Base estimated price calculation
    let estimatedPrice = basePricePerMarla * areaInMarla * typeMultiplier * bedroomMultiplier;

    // 7. For rental, estimate monthly rent using rental yield
    let monthlyRent = null;
    if (purpose === "Rent") {
      monthlyRent = Math.round((estimatedPrice * MARKET_TREND.rental_yield) / 12);
    }

    // 8. Create price range (±20% band)
    const rangeLow = Math.round(estimatedPrice * 0.80);
    const rangeHigh = Math.round(estimatedPrice * 1.20);
    estimatedPrice = Math.round(estimatedPrice);

    // 9. Determine area confidence
    const confidence = areaMatch ? "High" : "Medium";
    const confidencePct = areaMatch ? 82 : 65;

    // 10. Format helper
    const formatPKR = (amount) => {
      if (amount >= 10000000) return `PKR ${(amount / 10000000).toFixed(2)} Crore`;
      if (amount >= 100000) return `PKR ${(amount / 100000).toFixed(2)} Lakh`;
      return `PKR ${amount.toLocaleString()}`;
    };

    // 11. Build market insights
    const insights = [
      `Properties in ${city}${areaMatch ? `, ${areaMatch}` : ""} have appreciated ~12% in the last 12 months.`,
      `Average price per Marla in this area: ${formatPKR(Math.round(basePricePerMarla))}.`,
      purpose === "Rent"
        ? `Estimated monthly rent: ${formatPKR(monthlyRent)}, based on a 4.5% annual rental yield.`
        : `Investment horizon of 3 years could yield ~${formatPKR(Math.round(estimatedPrice * 1.40))} at current trends.`,
      `${confidence === "High" ? "Strong" : "Moderate"} data match for this location — confidence: ${confidencePct}%.`,
    ];

    return res.status(200).json({
      success: true,
      estimation: {
        city,
        location: location || "General Area",
        propertyType: propertyType || "Property",
        areaSize: parseFloat(areaSize),
        areaUnit,
        bedrooms: bedrooms || null,
        purpose: purpose || "Sell",
        estimatedPrice,
        estimatedPriceFormatted: formatPKR(estimatedPrice),
        rangeLow,
        rangeHigh,
        rangeLowFormatted: formatPKR(rangeLow),
        rangeHighFormatted: formatPKR(rangeHigh),
        monthlyRent: monthlyRent || null,
        monthlyRentFormatted: monthlyRent ? formatPKR(monthlyRent) : null,
        confidence,
        confidencePct,
        areaMatch: areaMatch || null,
        basePricePerMarla,
        basePricePerMarlaFormatted: formatPKR(basePricePerMarla),
        insights,
        disclaimer: "This estimate is AI-generated based on Pakistan real estate market data. Actual prices may vary based on property condition, specific location, and market conditions."
      }
    });
  } catch (err) {
    console.error("Price estimation error:", err);
    return res.status(500).json({ success: false, message: "Failed to estimate property price" });
  }
};

export const generateDescription = (req, res) => {
  try {
    const { title, purpose, propertyType, city, location, areaSize, areaUnit, bedrooms, bathrooms, amenities } = req.body;

    const areaStr = areaSize ? `${areaSize} ${areaUnit || 'Marla'}` : '';
    const bedsStr = bedrooms ? `${bedrooms} Beds` : '';
    const bathsStr = bathrooms ? `${bathrooms} Baths` : '';
    const details = [areaStr, bedsStr, bathsStr].filter(Boolean).join(', ');

    let description = `A premier ${propertyType || 'property'} is available for ${purpose === 'Rent' ? 'Rent' : 'Sale'} in the highly sought-after area of ${location || 'prime location'}, ${city || 'Pakistan'}.\n\n`;

    if (title) {
      description += `Featuring a beautiful layout, this listing is titled "${title}" and offers an outstanding opportunity for buyers and investors alike.\n\n`;
    }

    description += `Specifications:\n`;
    description += `• Property Type: ${propertyType || 'Residential'}\n`;
    if (areaSize) description += `• Size: ${areaSize} ${areaUnit || 'Marla'}\n`;
    if (bedrooms) description += `• Bedrooms: ${bedrooms}\n`;
    if (bathrooms) description += `• Bathrooms: ${bathrooms}\n`;
    description += `• Location: ${location || 'Prime Sector'}, ${city}\n\n`;

    if (amenities && amenities.length > 0) {
      description += `Premium Features & Amenities:\n`;
      amenities.forEach(amenity => {
        description += `• ${amenity}\n`;
      });
      description += `\n`;
    }

    description += `This property is strategically positioned in a vibrant neighborhood, offering close proximity to schools, hospitals, commercial hubs, and public transport. Whether you are looking for a dream home or a lucrative investment asset, this property stands out as a prime choice.\n\n`;
    description += `Don't miss this exclusive opportunity. Contact today for further details and to arrange a site visit.`;

    return res.status(200).json({
      success: true,
      description
    });
  } catch (error) {
    console.error("Description generation error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate property description" });
  }
};

export const analyzeInvestment = (req, res) => {
  try {
    const { price, propertyType, city, location, areaSize, areaUnit, purpose } = req.body;

    const prc = parseFloat(price) || 10000000;
    const isPrime = (location || "").toLowerCase().match(/(dha|bahria|clifton|gulberg|f-7|f-6|f-8|hayatabad|university)/i);

    // Calculate score based on parameters
    let rentabilityScore = 6.5;
    let annualAppreciation = 8.5;
    let investmentGrade = "B";

    if (isPrime) {
      rentabilityScore += 2.0;
      annualAppreciation += 4.0;
      investmentGrade = "A+";
    } else {
      rentabilityScore += 0.5;
      annualAppreciation += 1.5;
      investmentGrade = "A";
    }

    if (propertyType.includes("Plot") || propertyType.includes("Land")) {
      rentabilityScore -= 2.0; // Plots have lower rentability
      annualAppreciation += 2.0; // Higher capital growth
    }

    if (purpose === "Rent") {
      rentabilityScore += 1.0;
    }

    // Clamp score
    rentabilityScore = Math.min(10, Math.max(1, parseFloat(rentabilityScore.toFixed(1))));
    annualAppreciation = parseFloat(annualAppreciation.toFixed(1));

    const appreciation3Yr = `${Math.round(annualAppreciation * 3 * 0.9)}% - ${Math.round(annualAppreciation * 3 * 1.1)}%`;
    const appreciation5Yr = `${Math.round(annualAppreciation * 5 * 0.9)}% - ${Math.round(annualAppreciation * 5 * 1.1)}%`;

    const formatPKR = (amount) => {
      if (amount >= 10000000) return `PKR ${(amount / 10000000).toFixed(2)} Crore`;
      if (amount >= 100000) return `PKR ${(amount / 100000).toFixed(2)} Lakh`;
      return `PKR ${amount.toLocaleString()}`;
    };

    const estimatedRent3Yr = formatPKR(Math.round((prc * 0.045 * 1.25) / 12));

    const smartAdvice = [
      `Historically, properties in ${city} ${isPrime ? `prime sectors like ${location}` : ''} show a low volatility profile, making this a highly secure asset class.`,
      propertyType.includes("Plot") 
        ? "Plot investments offer maximum appreciation potential with zero maintenance, although monthly cash flow is minimal."
        : `This ${propertyType} represents strong rental yield capability with an estimated monthly rental growth rate of ~7-8% annually.`,
      isPrime 
        ? "Prime location tag commands a resale premium, ensuring excellent liquidity whenever you decide to exit this investment."
        : "Developing neighborhood suggests higher growth potential over a 5-10 year horizon, suitable for long-term patient capital."
    ];

    return res.status(200).json({
      success: true,
      analysis: {
        rentabilityScore,
        annualAppreciation: `${annualAppreciation}%`,
        appreciation3Yr,
        appreciation5Yr,
        investmentGrade,
        estimatedRent3Yr,
        smartAdvice,
        disclaimer: "This analysis is AI-simulated for educational purposes using local historical datasets. Actual market returns may vary based on micro-location parameters, developer credibility, and macroeconomic indicators."
      }
    });
  } catch (error) {
    console.error("Investment analysis error:", error);
    return res.status(500).json({ success: false, message: "Failed to compile investment analysis" });
  }
};

export const chatWithAi = (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: "message is required" });
    }

    const msg = message.toLowerCase();
    let reply = "";

    if (msg.includes("tax") || msg.includes("duty") || msg.includes("filer")) {
      reply = "In Pakistan, real estate transfers are subject to Federal and Provincial taxes. Active tax filers pay lower rates (approx 3% of FBR value) whereas non-filers pay much higher rates (up to 7-10%). Additionally, Capital Gains Tax (CGT) applies if you sell a property within the holding period (typically up to 6 years for plots, less for constructed homes).";
    } else if (msg.includes("dha") || msg.includes("defence")) {
      reply = "DHA (Defence Housing Authority) is a premium, secure, and highly liquid investment choice in Pakistan. Popular sectors include DHA Phase 6 & Phase 8 in Lahore, Phase 8 in Karachi, and DHA Phase 2 in Islamabad. They are ideal for high rental yields and stable, low-risk capital appreciation.";
    } else if (msg.includes("bahria")) {
      reply = "Bahria Town offers superb planned infrastructure, underground wiring, and top-tier security. It is highly suitable for genuine buyers wanting to build a home. While capital appreciation can be slightly slower compared to DHA, it offers excellent rental yields in populated blocks.";
    } else if (msg.includes("transfer") || msg.includes("process") || msg.includes("ndc")) {
      reply = "The typical property transfer process in Pakistan involves: \n1. Obtaining a No Demand Certificate (NDC) to confirm all dues are cleared.\n2. Society/Registry appointment.\n3. Submission of Transfer Documents.\n4. Paying withholding taxes (FBR) and local stamp duties.\n5. Issuance of Transfer Letter in the buyer's name.";
    } else if (msg.includes("document") || msg.includes("registry") || msg.includes("ownership")) {
      reply = "Before buying, always verify the following documents: \n• Allocation Letter / Transfer Letter from the developer/society.\n• Approved Building Plan / NOC from relevant authority (e.g. LDA, CDA, KDA).\n• Fard-e-Malkiat (for registry areas).\n• Clear utility clearance certificate. It is highly recommended to perform a formal legal verification at the society office.";
    } else if (msg.includes("rent") || msg.includes("yield") || msg.includes("monthly")) {
      reply = "Residential rental yields in major Pakistani cities (Lahore, Karachi, Islamabad) range from 4% to 6% annually. Commercial properties (shops, offices) offer higher yields, typically 7% to 9% annually, due to stronger corporate demand and longer lease terms.";
    } else if (msg.includes("islamabad") || msg.includes("cda")) {
      reply = "Islamabad's property market is highly active. Sectors like F-6, F-7, and F-8 command the highest residential prices, while sectors like G-13, G-14, and B-17 offer high growth potential for middle-income investors. CDA sectors offer secure government NOC approvals.";
    } else if (msg.includes("lahore") || msg.includes("lda")) {
      reply = "Lahore's market is dominated by DHA, Bahria Town, Gulberg, and Model Town. High-rise luxury flats in Gulberg and DHA Phase 5/6 have seen rapid interest, offering strong short-term rental yields and modern amenities.";
    } else if (msg.includes("karachi") || msg.includes("kda")) {
      reply = "Karachi's top-tier market is Clifton and DHA (particularly Phase 8 and Emaar Canyon Views). High-density apartment living is standard here. Bahria Town Karachi offers affordable housing options but is located further from the city center.";
    } else if (msg.includes("invest") || msg.includes("buy") || msg.includes("recommend")) {
      reply = "For short-term cash flow, choose commercial properties or high-rise luxury apartments in metropolitan hubs. For long-term low-risk appreciation, DHA residential plots remain the gold standard in Pakistan.";
    } else {
      reply = "Hello! I am your SRES Smart Real Estate Assistant. Ask me anything about Pakistan's property market, including buying/selling processes, DHA or Bahria investments, tax structures, rental yields, or document verification!";
    }

    return res.status(200).json({
      success: true,
      reply
    });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ success: false, message: "AI Assistant failed to reply" });
  }
};

// ──────────────────────────────────────────────
// AI Smart Area Suggestions per City
// ──────────────────────────────────────────────
const CITY_SMART_AREAS = {
  Lahore: [
    { name: "DHA Phase 6",     tags: ["High Appreciation", "Premium"],   pricePerMarla: "PKR 2.2 Cr",  suited: "Investors & End Users" },
    { name: "DHA Phase 5",     tags: ["Liquid Market", "Resale Easy"],   pricePerMarla: "PKR 1.8 Cr",  suited: "Investors" },
    { name: "Bahria Town",     tags: ["Affordable", "Good Rental"],       pricePerMarla: "PKR 75 Lakh", suited: "End Users" },
    { name: "Gulberg",         tags: ["Commercial Hub", "High Rent"],     pricePerMarla: "PKR 1.4 Cr",  suited: "Commercial Buyers" },
    { name: "Model Town",      tags: ["Established", "Stable Growth"],   pricePerMarla: "PKR 1.1 Cr",  suited: "End Users" },
    { name: "Johar Town",      tags: ["Mid-Budget", "Growing Area"],      pricePerMarla: "PKR 80 Lakh", suited: "First-Time Buyers" },
    { name: "Wapda Town",      tags: ["Budget-Friendly", "Large Plots"],  pricePerMarla: "PKR 60 Lakh", suited: "Long-Term Investors" },
    { name: "LDA Avenue",      tags: ["Developing", "High ROI Potential"],pricePerMarla: "PKR 55 Lakh", suited: "Investors" },
  ],
  Karachi: [
    { name: "DHA Phase 8",     tags: ["Premium", "Beachside"],            pricePerMarla: "PKR 2.0 Cr",  suited: "End Users & Investors" },
    { name: "Clifton",         tags: ["Ultra Premium", "Luxury Living"],  pricePerMarla: "PKR 1.8 Cr",  suited: "High Net Worth" },
    { name: "PECHS",           tags: ["Commercial Hub", "Central"],       pricePerMarla: "PKR 90 Lakh", suited: "Commercial Buyers" },
    { name: "Gulshan-e-Iqbal", tags: ["Residential", "Mid-Segment"],      pricePerMarla: "PKR 70 Lakh", suited: "End Users" },
    { name: "North Nazimabad", tags: ["Affordable", "Established"],       pricePerMarla: "PKR 60 Lakh", suited: "First-Time Buyers" },
    { name: "Bahria Town KHI", tags: ["Planned", "Gated Security"],       pricePerMarla: "PKR 65 Lakh", suited: "End Users" },
  ],
  Islamabad: [
    { name: "F-7",             tags: ["Ultra Premium", "Diplomatic Zone"],pricePerMarla: "PKR 5.5 Cr",  suited: "High Net Worth" },
    { name: "F-6",             tags: ["Most Expensive", "Diplomatic"],    pricePerMarla: "PKR 6.0 Cr",  suited: "Premium Buyers" },
    { name: "F-10",            tags: ["Established", "Good Amenities"],   pricePerMarla: "PKR 3.0 Cr",  suited: "End Users" },
    { name: "G-13",            tags: ["High Appreciation", "Developing"], pricePerMarla: "PKR 2.2 Cr",  suited: "Investors" },
    { name: "DHA Phase 2",     tags: ["Planned", "Safe Investment"],      pricePerMarla: "PKR 3.5 Cr",  suited: "Investors" },
    { name: "Bahria Town",     tags: ["Affordable", "Gated Community"],   pricePerMarla: "PKR 1.2 Cr",  suited: "First-Time Buyers" },
  ],
  Rawalpindi: [
    { name: "DHA Rawalpindi",  tags: ["Secure", "High Rental Yield"],     pricePerMarla: "PKR 1.0 Cr",  suited: "Investors" },
    { name: "Bahria Phase 7",  tags: ["Gated", "Family Living"],          pricePerMarla: "PKR 90 Lakh", suited: "End Users" },
    { name: "Satellite Town",  tags: ["Established", "Budget-Friendly"],  pricePerMarla: "PKR 55 Lakh", suited: "First-Time Buyers" },
    { name: "Gulraiz Housing", tags: ["Growing", "Affordable"],           pricePerMarla: "PKR 50 Lakh", suited: "Long-Term Investors" },
  ],
  Peshawar: [
    { name: "Hayatabad",       tags: ["Most Premium", "Peaceful"],        pricePerMarla: "PKR 60 Lakh", suited: "End Users" },
    { name: "University Town", tags: ["Rental Income", "Good ROI"],       pricePerMarla: "PKR 55 Lakh", suited: "Investors" },
    { name: "Phase 4",         tags: ["Developing", "Affordable"],        pricePerMarla: "PKR 45 Lakh", suited: "First-Time Buyers" },
  ],
  Multan: [
    { name: "DHA Multan",      tags: ["New Launch", "High Appreciation"], pricePerMarla: "PKR 70 Lakh", suited: "Investors" },
    { name: "Bahria Town",     tags: ["Planned City", "Affordable"],      pricePerMarla: "PKR 50 Lakh", suited: "End Users" },
    { name: "Model Town",      tags: ["Established", "Good Rent"],        pricePerMarla: "PKR 40 Lakh", suited: "End Users" },
  ],
  Faisalabad: [
    { name: "DHA Faisalabad",  tags: ["Premium", "Growing"],              pricePerMarla: "PKR 60 Lakh", suited: "Investors" },
    { name: "Gulberg",         tags: ["Commercial Hub", "High Rent"],     pricePerMarla: "PKR 40 Lakh", suited: "Commercial Buyers" },
    { name: "Susan Road",      tags: ["Mid-Segment", "Accessible"],       pricePerMarla: "PKR 35 Lakh", suited: "First-Time Buyers" },
  ],
  Quetta: [
    { name: "Satellite Town",  tags: ["Most Developed", "Safe"],          pricePerMarla: "PKR 35 Lakh", suited: "End Users" },
    { name: "Model Town",      tags: ["Established", "Affordable"],       pricePerMarla: "PKR 30 Lakh", suited: "End Users" },
  ],
};

export const getSmartAreaSuggestions = (req, res) => {
  try {
    const { city } = req.query;
    if (!city) {
      return res.status(400).json({ success: false, message: "city query parameter is required" });
    }

    const areas = CITY_SMART_AREAS[city];
    if (!areas) {
      return res.status(404).json({ success: false, message: `No data available for city: ${city}` });
    }

    return res.status(200).json({
      success: true,
      city,
      areas,
      tip: `Based on current Pakistan real estate trends, here are the best areas to buy or invest in ${city}.`
    });
  } catch (error) {
    console.error("Smart area suggestions error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch smart area suggestions" });
  }
};

// ──────────────────────────────────────────────
// 1. AI Property Matchmaker
// ──────────────────────────────────────────────
export const calculatePropertyMatchmaker = (req, res) => {
  try {
    const { maxBudget, city, propertyType, purpose, minBedrooms, goal } = req.body;

    const sampleProperties = [
      {
        id: 101,
        title: "Modern 1 Kanal Luxury Villa",
        city: "Lahore",
        location: "DHA Phase 6",
        propertyType: "House",
        purpose: "Sell",
        price: 58000000,
        areaSize: 1,
        areaUnit: "Kanal",
        bedrooms: "5",
        bathrooms: "6",
        amenities: ["Swimming Pool", "Lawn", "Jacuzzi", "Generator Backup", "Smart Home Automation"]
      },
      {
        id: 102,
        title: "3 Bedroom Executive Apartment",
        city: "Lahore",
        location: "Gulberg III",
        propertyType: "Flat",
        purpose: "Rent",
        price: 220000,
        areaSize: 10,
        areaUnit: "Marla",
        bedrooms: "3",
        bathrooms: "3",
        amenities: ["Elevator", "Security Staff", "Covered Parking", "Gym"]
      },
      {
        id: 103,
        title: "10 Marla Corner House in F-11",
        city: "Islamabad",
        location: "F-11 Sector",
        propertyType: "House",
        purpose: "Sell",
        price: 65000000,
        areaSize: 10,
        areaUnit: "Marla",
        bedrooms: "4",
        bathrooms: "5",
        amenities: ["Spacious Lawn", "Servant Quarter", "Gas & Electricity", "Double Storey"]
      },
      {
        id: 104,
        title: "DHA Phase 8 Sea View Penthouse",
        city: "Karachi",
        location: "DHA Phase 8",
        propertyType: "Penthouse",
        purpose: "Sell",
        price: 85000000,
        areaSize: 14,
        areaUnit: "Marla",
        bedrooms: "4",
        bathrooms: "5",
        amenities: ["Sea View", "Private Terrace", "Central AC", "CCTV Security"]
      },
      {
        id: 105,
        title: "5 Marla Brand New House",
        city: "Lahore",
        location: "Bahria Town Sector C",
        propertyType: "House",
        purpose: "Sell",
        price: 24500000,
        areaSize: 5,
        areaUnit: "Marla",
        bedrooms: "3",
        bathrooms: "4",
        amenities: ["Gated Security", "Spanish Tile Flooring", "Solid Wood Doors"]
      },
      {
        id: 106,
        title: "Commercial Office Space",
        city: "Islamabad",
        location: "Blue Area",
        propertyType: "Office",
        purpose: "Rent",
        price: 450000,
        areaSize: 8,
        areaUnit: "Marla",
        bedrooms: null,
        bathrooms: "2",
        amenities: ["High Speed Elevators", "24/7 Power Backup", "Dedicated Parking"]
      }
    ];

    const userBudget = parseFloat(maxBudget) || 100000000;
    const userCity = city || "Lahore";
    const userGoal = goal || "High Capital Growth";

    const scoredList = sampleProperties.map(p => {
      let score = 50;
      const pPrice = parseFloat(p.price);

      if (p.city && p.city.toLowerCase() === userCity.toLowerCase()) {
        score += 25;
      }

      if (pPrice <= userBudget) {
        score += 20;
        if (pPrice >= userBudget * 0.7) score += 5;
      } else {
        const overPct = (pPrice - userBudget) / userBudget;
        if (overPct < 0.15) score += 5;
        else score -= 20;
      }

      if (purpose && p.purpose === purpose) {
        score += 10;
      }

      if (propertyType && p.propertyType === propertyType) {
        score += 10;
      }

      if (minBedrooms && p.bedrooms) {
        if (parseInt(p.bedrooms) >= parseInt(minBedrooms)) score += 10;
      }

      if (userGoal === "High Capital Growth" && (p.location.includes("DHA") || p.location.includes("Gulberg") || p.location.includes("F-"))) {
        score += 10;
      } else if (userGoal === "High Rental Income" && (p.purpose === "Rent" || p.propertyType === "Flat" || p.propertyType === "Commercial")) {
        score += 10;
      } else if (userGoal === "Peaceful Family Living" && p.propertyType === "House" && p.bedrooms >= 3) {
        score += 10;
      }

      const matchPercentage = Math.min(99, Math.max(45, score));

      const formatPKR = (amt) => {
        if (amt >= 10000000) return `PKR ${(amt / 10000000).toFixed(2)} Crore`;
        if (amt >= 100000) return `PKR ${(amt / 100000).toFixed(2)} Lakh`;
        return `PKR ${amt.toLocaleString()}`;
      };

      const pros = [];
      const cons = [];

      if (pPrice <= userBudget) pros.push("Fits comfortably within specified target budget");
      else cons.push("Slightly exceeds target budget allocation");

      if (p.location.includes("DHA") || p.location.includes("Bahria") || p.location.includes("Gulberg")) {
        pros.push("Prime location with high liquidity & security");
      } else {
        pros.push("Growing sector with strong appreciation potential");
      }

      if (p.bedrooms && parseInt(p.bedrooms) >= 4) pros.push("Spacious layout for large family living");

      return {
        id: p.id,
        title: p.title,
        city: p.city,
        location: p.location,
        propertyType: p.propertyType,
        purpose: p.purpose,
        price: p.price,
        priceFormatted: formatPKR(p.price),
        areaSize: p.areaSize,
        areaUnit: p.areaUnit,
        bedrooms: p.bedrooms || null,
        bathrooms: p.bathrooms || null,
        matchPercentage,
        pros,
        cons,
        aiVerdict: `Rated ${matchPercentage}% match for ${userGoal} in ${p.city}.`
      };
    });

    scoredList.sort((a, b) => b.matchPercentage - a.matchPercentage);
    const topMatches = scoredList.slice(0, 5);

    return res.status(200).json({
      success: true,
      matches: topMatches,
      summary: {
        totalAnalyzed: sampleProperties.length,
        userCity: userCity,
        userBudget: userBudget,
        userGoal: userGoal
      }
    });
  } catch (err) {
    console.error("Matchmaker error:", err);
    return res.status(500).json({ success: false, message: "Matchmaker engine failed" });
  }
};

// ──────────────────────────────────────────────
// 2. AI Mortgage & Loan Affordability Calculator
// ──────────────────────────────────────────────
export const calculateMortgageAffordability = (req, res) => {
  try {
    const { propertyPrice, downPaymentPct = 20, loanTermYears = 20, interestRatePct = 13.5, monthlyIncome } = req.body;

    const price = parseFloat(propertyPrice);
    if (!price || isNaN(price) || price <= 0) {
      return res.status(400).json({ success: false, message: "Valid propertyPrice is required" });
    }

    const downPct = parseFloat(downPaymentPct) || 20;
    const termYears = parseFloat(loanTermYears) || 20;
    const ratePct = parseFloat(interestRatePct) || 13.5;
    const income = parseFloat(monthlyIncome) || null;

    const downPaymentAmount = price * (downPct / 100);
    const loanAmount = price - downPaymentAmount;

    const r = (ratePct / 100) / 12;
    const n = termYears * 12;

    const emi = (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalPayment = emi * n;
    const totalInterest = totalPayment - loanAmount;

    const formatPKR = (amt) => {
      if (!amt || isNaN(amt)) return "PKR 0";
      if (amt >= 10000000) return `PKR ${(amt / 10000000).toFixed(2)} Crore`;
      if (amt >= 100000) return `PKR ${(amt / 100000).toFixed(2)} Lakh`;
      return `PKR ${Math.round(amt).toLocaleString()}`;
    };

    let debtToIncomeRatio = null;
    let affordabilityStatus = "Moderate Risk 🟡";
    let statusColor = "warning";

    if (income && income > 0) {
      debtToIncomeRatio = parseFloat(((emi / income) * 100).toFixed(1));
      if (debtToIncomeRatio <= 30) {
        affordabilityStatus = "Comfortable & Safe 🟢";
        statusColor = "success";
      } else if (debtToIncomeRatio <= 45) {
        affordabilityStatus = "Moderate Financial Risk 🟡";
        statusColor = "warning";
      } else {
        affordabilityStatus = "High Financial Stress 🔴";
        statusColor = "danger";
      }
    }

    const bankComparison = [
      { bank: "Meezan Bank (Islamic)", rate: "12.5%", estimatedEmi: formatPKR((loanAmount * ((0.125/12) * Math.pow(1 + 0.125/12, n))) / (Math.pow(1 + 0.125/12, n) - 1)) },
      { bank: "HBL Islamic Home Finance", rate: "13.0%", estimatedEmi: formatPKR((loanAmount * ((0.13/12) * Math.pow(1 + 0.13/12, n))) / (Math.pow(1 + 0.13/12, n) - 1)) },
      { bank: "Bank Alfalah Ghar Aasan", rate: "13.8%", estimatedEmi: formatPKR((loanAmount * ((0.138/12) * Math.pow(1 + 0.138/12, n))) / (Math.pow(1 + 0.138/12, n) - 1)) }
    ];

    const aiAdvice = [
      `A down payment of ${downPct}% (${formatPKR(downPaymentAmount)}) leaves a net home loan of ${formatPKR(loanAmount)}.`,
      `Estimated monthly EMI is ${formatPKR(emi)} over a ${termYears}-year duration.`,
      debtToIncomeRatio
        ? `Your Debt-to-Income ratio is ${debtToIncomeRatio}%. ${debtToIncomeRatio > 40 ? "Consider increasing down payment to lower monthly burden." : "This fits safely within recommended financial parameters."}`
        : "Add your monthly income to evaluate exact Debt-to-Income suitability.",
      "Islamic Diminishing Musharakah plans offer fixed profit rate stability in Pakistan."
    ];

    return res.status(200).json({
      success: true,
      calculation: {
        propertyPrice: price,
        propertyPriceFormatted: formatPKR(price),
        downPaymentPct: downPct,
        downPaymentAmount,
        downPaymentAmountFormatted: formatPKR(downPaymentAmount),
        loanAmount,
        loanAmountFormatted: formatPKR(loanAmount),
        loanTermYears: termYears,
        interestRatePct: ratePct,
        monthlyEmi: Math.round(emi),
        monthlyEmiFormatted: formatPKR(emi),
        totalInterest: Math.round(totalInterest),
        totalInterestFormatted: formatPKR(totalInterest),
        totalPayment: Math.round(totalPayment),
        totalPaymentFormatted: formatPKR(totalPayment),
        debtToIncomeRatio,
        affordabilityStatus,
        statusColor,
        bankComparison,
        aiAdvice
      }
    });
  } catch (err) {
    console.error("Mortgage calculation error:", err);
    return res.status(500).json({ success: false, message: "Mortgage calculator engine failed" });
  }
};

// ──────────────────────────────────────────────
// 3. AI Property Comparison Tool
// ──────────────────────────────────────────────
export const compareTwoProperties = (req, res) => {
  try {
    const { propertyA, propertyB } = req.body;
    if (!propertyA || !propertyB) {
      return res.status(400).json({ success: false, message: "Both propertyA and propertyB are required" });
    }

    const convertToMarla = (size, unit) => {
      const s = parseFloat(size) || 1;
      if (unit === "Kanal") return s * 20;
      if (unit === "Sq. Ft.") return s / 272.25;
      if (unit === "Sq. Yd.") return s / 30.25;
      return s;
    };

    const marlaA = convertToMarla(propertyA.areaSize, propertyA.areaUnit);
    const marlaB = convertToMarla(propertyB.areaSize, propertyB.areaUnit);

    const pricePerMarlaA = Math.round(parseFloat(propertyA.price) / marlaA);
    const pricePerMarlaB = Math.round(parseFloat(propertyB.price) / marlaB);

    const isPrimeA = (propertyA.location || "").toLowerCase().match(/(dha|bahria|clifton|gulberg|f-7|f-6|f-8)/i);
    const isPrimeB = (propertyB.location || "").toLowerCase().match(/(dha|bahria|clifton|gulberg|f-7|f-6|f-8)/i);

    const yieldA = isPrimeA ? 5.5 : 4.2;
    const yieldB = isPrimeB ? 5.5 : 4.2;

    const roi3YrA = isPrimeA ? "35% - 42%" : "22% - 30%";
    const roi3YrB = isPrimeB ? "35% - 42%" : "22% - 30%";

    const scoreA = (isPrimeA ? 4.5 : 3.0) + (propertyA.purpose === "Sell" ? 3.5 : 3.0);
    const scoreB = (isPrimeB ? 4.5 : 3.0) + (propertyB.purpose === "Sell" ? 3.5 : 3.0);

    const formatPKR = (amt) => {
      const a = parseFloat(amt);
      if (a >= 10000000) return `PKR ${(a / 10000000).toFixed(2)} Cr`;
      if (a >= 100000) return `PKR ${(a / 100000).toFixed(2)} Lakh`;
      return `PKR ${Math.round(a).toLocaleString()}`;
    };

    let winner = "Tie";
    let winnerReason = "Both properties present balanced value propositions.";

    if (scoreA > scoreB) {
      winner = "Property A";
      winnerReason = `${propertyA.title || 'Property A'} offers higher location stability and better projected capital appreciation.`;
    } else if (scoreB > scoreA) {
      winner = "Property B";
      winnerReason = `${propertyB.title || 'Property B'} offers higher location stability and better projected capital appreciation.`;
    } else if (pricePerMarlaA < pricePerMarlaB) {
      winner = "Property A";
      winnerReason = `${propertyA.title || 'Property A'} provides lower price per Marla (${formatPKR(pricePerMarlaA)} vs ${formatPKR(pricePerMarlaB)}).`;
    } else if (pricePerMarlaB < pricePerMarlaA) {
      winner = "Property B";
      winnerReason = `${propertyB.title || 'Property B'} provides lower price per Marla (${formatPKR(pricePerMarlaB)} vs ${formatPKR(pricePerMarlaA)}).`;
    }

    return res.status(200).json({
      success: true,
      comparison: {
        propertyA: {
          ...propertyA,
          priceFormatted: formatPKR(propertyA.price),
          marlaSize: marlaA.toFixed(1),
          pricePerMarlaFormatted: formatPKR(pricePerMarlaA),
          rentalYield: `${yieldA}%`,
          roi3Yr: roi3YrA,
          score: Math.min(9.8, scoreA + 1).toFixed(1)
        },
        propertyB: {
          ...propertyB,
          priceFormatted: formatPKR(propertyB.price),
          marlaSize: marlaB.toFixed(1),
          pricePerMarlaFormatted: formatPKR(pricePerMarlaB),
          rentalYield: `${yieldB}%`,
          roi3Yr: roi3YrB,
          score: Math.min(9.8, scoreB + 1).toFixed(1)
        },
        winner,
        winnerReason
      }
    });
  } catch (err) {
    console.error("Property comparison error:", err);
    return res.status(500).json({ success: false, message: "Property comparison engine failed" });
  }
};

// ──────────────────────────────────────────────
// 4. AI Deal Score & Fair Value Rating
// ──────────────────────────────────────────────
export const calculateDealScore = (req, res) => {
  try {
    const { price, city, location, propertyType = "House", areaSize = 10, areaUnit = "Marla" } = req.body;

    const prc = parseFloat(price);
    if (!prc || isNaN(prc) || prc <= 0) {
      return res.status(400).json({ success: false, message: "Valid price is required" });
    }

    const cityData = CITY_BASE_PRICES[city] || CITY_BASE_PRICES["Lahore"];
    let basePricePerMarla = cityData.default;

    const areaMatch = findAreaMatch(location, cityData.areas);
    if (areaMatch) basePricePerMarla = cityData.areas[areaMatch];

    const conversionFactor = TO_MARLA[areaUnit] || 1;
    const areaInMarla = parseFloat(areaSize) * conversionFactor;
    const typeMultiplier = TYPE_MULTIPLIERS[propertyType] || 1.0;

    const estimatedMarketPrice = basePricePerMarla * areaInMarla * typeMultiplier;
    const diffPct = ((prc - estimatedMarketPrice) / estimatedMarketPrice) * 100;

    let dealRating = "Fair Price ⚖️";
    let dealBadgeColor = "blue";
    let dealScore = 75;

    if (diffPct <= -12) {
      dealRating = "Great Deal 🔥";
      dealBadgeColor = "green";
      dealScore = Math.min(98, Math.round(85 + Math.abs(diffPct)));
    } else if (diffPct <= -3) {
      dealRating = "Below Market Price 🟢";
      dealBadgeColor = "green";
      dealScore = Math.round(80 + Math.abs(diffPct));
    } else if (diffPct <= 10) {
      dealRating = "Fair Market Price ⚖️";
      dealBadgeColor = "blue";
      dealScore = 72;
    } else {
      dealRating = "Overpriced Warning ⚠️";
      dealBadgeColor = "orange";
      dealScore = Math.max(35, Math.round(65 - diffPct));
    }

    const formatPKR = (amt) => {
      const a = Math.round(amt);
      if (a >= 10000000) return `PKR ${(a / 10000000).toFixed(2)} Crore`;
      if (a >= 100000) return `PKR ${(a / 100000).toFixed(2)} Lakh`;
      return `PKR ${a.toLocaleString()}`;
    };

    return res.status(200).json({
      success: true,
      deal: {
        price: prc,
        priceFormatted: formatPKR(prc),
        estimatedMarketPrice: Math.round(estimatedMarketPrice),
        estimatedMarketPriceFormatted: formatPKR(estimatedMarketPrice),
        rangeLowFormatted: formatPKR(estimatedMarketPrice * 0.85),
        rangeHighFormatted: formatPKR(estimatedMarketPrice * 1.15),
        diffPct: parseFloat(diffPct.toFixed(1)),
        dealRating,
        dealBadgeColor,
        dealScore,
        advice: diffPct > 10
          ? `Property is listed ~${diffPct.toFixed(1)}% above sector benchmark. Target negotiation near ${formatPKR(estimatedMarketPrice)}.`
          : diffPct < -10
          ? `Listed ~${Math.abs(diffPct).toFixed(1)}% below estimated market average! Excellent opportunity.`
          : `Priced accurately according to current sector baseline rates.`
      }
    });
  } catch (err) {
    console.error("Deal score error:", err);
    return res.status(500).json({ success: false, message: "Deal score engine failed" });
  }
};




