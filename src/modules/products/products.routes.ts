import { Router } from "express";
import { uuidSchema } from "../../lib/schemas.js";
import { getUserId, requireAuth } from "../../middleware/auth.js";
import {
  adjustStockSchema,
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from "./products.schemas.js";
import {
  adjustProductStock,
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "./products.service.js";

export const productsRouter = Router();

productsRouter.use(requireAuth);

productsRouter.get("/", async (req, res) => {
  const query = listProductsQuerySchema.parse(req.query);
  const result = await listProducts(getUserId(req), query);
  res.json({ data: result.data, meta: result.meta });
});

productsRouter.post("/", async (req, res) => {
  const input = createProductSchema.parse(req.body);
  const product = await createProduct(getUserId(req), input);
  res.status(201).json({ data: product });
});

productsRouter.get("/:id", async (req, res) => {
  const productId = uuidSchema.parse(req.params.id);
  const product = await getProduct(getUserId(req), productId);
  res.json({ data: product });
});

productsRouter.patch("/:id", async (req, res) => {
  const productId = uuidSchema.parse(req.params.id);
  const input = updateProductSchema.parse(req.body);
  const product = await updateProduct(getUserId(req), productId, input);
  res.json({ data: product });
});

productsRouter.post("/:id/stock", async (req, res) => {
  const productId = uuidSchema.parse(req.params.id);
  const input = adjustStockSchema.parse(req.body);
  const product = await adjustProductStock(getUserId(req), productId, input);
  res.json({ data: product });
});

productsRouter.delete("/:id", async (req, res) => {
  const productId = uuidSchema.parse(req.params.id);
  await deleteProduct(getUserId(req), productId);
  res.status(204).end();
});
