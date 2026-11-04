import { Router } from "express";
import {
  currentMonth,
  startOfMonth,
  todayInAppTimeZone,
} from "../../lib/dates.js";
import { csvRow } from "../../lib/csv.js";
import { logger } from "../../lib/logger.js";
import { toRupiah } from "../../lib/money.js";
import { getUserId, requireAuth } from "../../middleware/auth.js";
import { exportQuerySchema } from "./export.schemas.js";
import { listTransactionsForExport } from "../transactions/transactions.service.js";

export const exportRouter = Router();

exportRouter.use(requireAuth);

const BATCH_SIZE = 1_000;

function formatCsvAmount(rawAmount: string): string {
  const amount = toRupiah(rawAmount);
  return Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2);
}

function typeLabel(type: "expense" | "income"): string {
  return type === "expense" ? "Pengeluaran" : "Pemasukan";
}

exportRouter.get("/transactions.csv", async (req, res) => {
  const query = exportQuerySchema.parse(req.query);
  const today = todayInAppTimeZone();

  const from =
    query.from ??
    (query.to ? "2000-01-01" : startOfMonth(currentMonth()));
  const to = query.to ?? today;

  const filename = `transaksi-${from}_sampai_${to}.csv`;

  res.status(200);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`,
  );
  res.setHeader("Cache-Control", "no-store");

  res.write("\uFEFF");
  res.write(
    `${csvRow([
      "Tanggal",
      "Jenis",
      "Kategori",
      "Nominal",
      "Catatan",
      "ID Transaksi",
    ])}\r\n`,
  );

  let offset = 0;

  try {
    while (!res.destroyed) {
      const rows = await listTransactionsForExport(
        getUserId(req),
        {
          from,
          to,
          ...(query.type ? { type: query.type } : {}),
          ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        },
        BATCH_SIZE,
        offset,
      );

      if (rows.length === 0) break;

      const chunk = rows
        .map((row) =>
          csvRow([
            row.transactionDate,
            typeLabel(row.type),
            row.categoryName,
            formatCsvAmount(row.amount),
            row.note,
            row.id,
          ]),
        )
        .join("\r\n");

      res.write(`${chunk}\r\n`);
      offset += rows.length;

      if (rows.length < BATCH_SIZE) break;
    }

    res.end();
  } catch (error) {
    logger.error(
      { err: error, userId: getUserId(req), from, to },
      "Ekspor CSV gagal di tengah proses",
    );

    if (!res.headersSent) {
      throw error;
    }
    res.end();
  }
});
