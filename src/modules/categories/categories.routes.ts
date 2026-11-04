import { Router } from "express";
import { uuidSchema } from "../../lib/schemas.js";
import { getUserId, requireAuth } from "../../middleware/auth.js";
import {
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from "./categories.schemas.js";
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "./categories.service.js";

export const categoriesRouter = Router();

categoriesRouter.use(requireAuth);

categoriesRouter.get("/", async (req, res) => {
  const query = listCategoriesQuerySchema.parse(req.query);
  const categories = await listCategories(getUserId(req), query);
  res.json({ data: categories });
});

categoriesRouter.post("/", async (req, res) => {
  const input = createCategorySchema.parse(req.body);
  const category = await createCategory(getUserId(req), input);
  res.status(201).json({ data: category });
});

categoriesRouter.get("/:id", async (req, res) => {
  const categoryId = uuidSchema.parse(req.params.id);
  const category = await getCategory(getUserId(req), categoryId);
  res.json({ data: category });
});

categoriesRouter.patch("/:id", async (req, res) => {
  const categoryId = uuidSchema.parse(req.params.id);
  const input = updateCategorySchema.parse(req.body);
  const category = await updateCategory(getUserId(req), categoryId, input);
  res.json({ data: category });
});

categoriesRouter.delete("/:id", async (req, res) => {
  const categoryId = uuidSchema.parse(req.params.id);
  await deleteCategory(getUserId(req), categoryId);
  res.status(204).end();
});
