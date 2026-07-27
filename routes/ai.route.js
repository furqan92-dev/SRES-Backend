import express from "express";
import {
  estimatePropertyPrice,
  generateDescription,
  analyzeInvestment,
  chatWithAi,
  getSmartAreaSuggestions,
  calculatePropertyMatchmaker,
  calculateMortgageAffordability,
  compareTwoProperties,
  calculateDealScore
} from "../controllers/ai.controller.js";

const router = express.Router();

router.post("/estimate-price", estimatePropertyPrice);
router.post("/generate-description", generateDescription);
router.post("/analyze-investment", analyzeInvestment);
router.post("/chat", chatWithAi);
router.get("/smart-areas", getSmartAreaSuggestions);

router.post("/property-matchmaker", calculatePropertyMatchmaker);
router.post("/mortgage-calculator", calculateMortgageAffordability);
router.post("/compare-properties", compareTwoProperties);
router.post("/deal-score", calculateDealScore);

export default router;

