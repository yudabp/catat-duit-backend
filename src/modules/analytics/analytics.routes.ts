import { Router } from "express";
import { getUserId, requireAuth } from "../../middleware/auth.js";
import {
  categoryBreakdownQuerySchema,
  monthsQuerySchema,
  summaryQuerySchema,
  trendQuerySchema,
} from "./analytics.schemas.js";
import {
  getAvailableMonths,
  getCategoryBreakdown,
  getDailyTrend,
  getMonthlySummary,
} from "./analytics.service.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

analyticsRouter.get("/summary", async (req, res) => {
  const query = summaryQuerySchema.parse(req.query);
  const summary = await getMonthlySummary(getUserId(req), query);
  res.json({ data: summary });
});

analyticsRouter.get("/categories", async (req, res) => {
  const query = categoryBreakdownQuerySchema.parse(req.query);
  const breakdown = await getCategoryBreakdown(getUserId(req), query);
  res.json({ data: breakdown });
});

analyticsRouter.get("/trend", async (req, res) => {
  const query = trendQuerySchema.parse(req.query);
  const trend = await getDailyTrend(getUserId(req), query);
  res.json({ data: trend });
});

analyticsRouter.get("/months", async (req, res) => {
  const query = monthsQuerySchema.parse(req.query);
  const months = await getAvailableMonths(getUserId(req), query);
  res.json({ data: months });
});
