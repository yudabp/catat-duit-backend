import { Router } from "express";
import { uuidSchema } from "../../lib/schemas.js";
import { getUserId, requireAuth } from "../../middleware/auth.js";
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  syncTransactionsSchema,
  updateTransactionSchema,
} from "./transactions.schemas.js";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  syncTransactions,
  updateTransaction,
} from "./transactions.service.js";

export const transactionsRouter = Router();

transactionsRouter.use(requireAuth);

transactionsRouter.post("/sync", async (req, res) => {
  const input = syncTransactionsSchema.parse(req.body);
  const result = await syncTransactions(getUserId(req), input.transactions);
  res.json({ data: result });
});

transactionsRouter.get("/", async (req, res) => {
  const query = listTransactionsQuerySchema.parse(req.query);
  const result = await listTransactions(getUserId(req), query);
  res.json({ data: result.data, meta: result.meta });
});

transactionsRouter.post("/", async (req, res) => {
  const input = createTransactionSchema.parse(req.body);
  const result = await createTransaction(getUserId(req), input);

  if (result.replay) {
    res.setHeader("Idempotent-Replay", "true");
    res.status(200).json({ data: result.transaction, meta: { replay: true } });
    return;
  }

  res.status(201).json({ data: result.transaction, meta: { replay: false } });
});

transactionsRouter.get("/:id", async (req, res) => {
  const transactionId = uuidSchema.parse(req.params.id);
  const transaction = await getTransaction(getUserId(req), transactionId);
  res.json({ data: transaction });
});

transactionsRouter.patch("/:id", async (req, res) => {
  const transactionId = uuidSchema.parse(req.params.id);
  const input = updateTransactionSchema.parse(req.body);
  const transaction = await updateTransaction(
    getUserId(req),
    transactionId,
    input,
  );
  res.json({ data: transaction });
});

transactionsRouter.delete("/:id", async (req, res) => {
  const transactionId = uuidSchema.parse(req.params.id);
  await deleteTransaction(getUserId(req), transactionId);
  res.status(204).end();
});
