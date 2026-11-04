import { Router } from "express";
import { uuidSchema } from "../../lib/schemas.js";
import { getUserId, requireAuth } from "../../middleware/auth.js";
import {
  createBudgetSchema,
  listBudgetsQuerySchema,
  updateBudgetSchema,
} from "./budgets.schemas.js";
import {
  createBudget,
  deleteBudget,
  getBudget,
  listBudgets,
  updateBudget,
} from "./budgets.service.js";

export const budgetsRouter = Router();

budgetsRouter.use(requireAuth);

budgetsRouter.get("/", async (req, res) => {
  const query = listBudgetsQuerySchema.parse(req.query);
  const budgets = await listBudgets(getUserId(req), query);
  res.json({ data: budgets });
});

budgetsRouter.post("/", async (req, res) => {
  const input = createBudgetSchema.parse(req.body);
  const budget = await createBudget(getUserId(req), input);
  res.status(201).json({ data: budget });
});

budgetsRouter.get("/:id", async (req, res) => {
  const budgetId = uuidSchema.parse(req.params.id);
  const budget = await getBudget(getUserId(req), budgetId);
  res.json({ data: budget });
});

budgetsRouter.patch("/:id", async (req, res) => {
  const budgetId = uuidSchema.parse(req.params.id);
  const input = updateBudgetSchema.parse(req.body);
  const budget = await updateBudget(getUserId(req), budgetId, input);
  res.json({ data: budget });
});

budgetsRouter.delete("/:id", async (req, res) => {
  const budgetId = uuidSchema.parse(req.params.id);
  await deleteBudget(getUserId(req), budgetId);
  res.status(204).end();
});
