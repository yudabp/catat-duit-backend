import {
  and,
  asc,
  desc,
  eq,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../../db/index.js";
import { categories, transactions } from "../../db/schema.js";
import { isUniqueViolation } from "../../lib/db-errors.js";
import { conflict, forbidden, notFound } from "../../lib/errors.js";
import type {
  CategoryType,
  NewCategory,
} from "../../db/schema.js";
import type {
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput,
} from "./categories.schemas.js";

type CategoryRow = {
  id: string;
  userId: string | null;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: Date;
};

export type CategoryResponse = {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  isDefault: boolean;
  isArchived: boolean;
  usageCount: number;
  createdAt: string;
};

function serializeCategory(row: CategoryRow, usageCount = 0): CategoryResponse {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    icon: row.icon,
    color: row.color,
    isDefault: row.isDefault,
    isArchived: row.isArchived,
    usageCount,
    createdAt: row.createdAt.toISOString(),
  };
}

async function countUsageByCategory(
  userId: string,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .groupBy(transactions.categoryId);

  return new Map(rows.map((row) => [row.categoryId, row.count]));
}

export async function listCategories(
  userId: string,
  query: ListCategoriesQuery,
): Promise<CategoryResponse[]> {
  const conditions = [
    or(isNull(categories.userId), eq(categories.userId, userId)),
  ];

  if (!query.includeArchived) {
    conditions.push(eq(categories.isArchived, false));
  }

  if (query.type) {
    conditions.push(
      or(
        eq(categories.type, query.type),
        eq(categories.type, "both"),
      ),
    );
  }

  const [rows, usageCounts] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(and(...conditions))
      .orderBy(desc(categories.isDefault), asc(categories.name)),
    countUsageByCategory(userId),
  ]);

  return rows.map((row) =>
    serializeCategory(row, usageCounts.get(row.id) ?? 0),
  );
}

export async function getCategory(
  userId: string,
  categoryId: string,
): Promise<CategoryResponse> {
  const [row] = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        or(isNull(categories.userId), eq(categories.userId, userId)),
      ),
    )
    .limit(1);

  if (!row) {
    throw notFound("Kategori tidak ditemukan");
  }

  const [usage] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.categoryId, categoryId),
      ),
    );

  return serializeCategory(row, usage?.count ?? 0);
}

/**
 * Mengembalikan kategori yang boleh dipakai untuk transaksi baru.
 * Kategori bawaan (user_id NULL) dan kategori milik user dianggap valid.
 */
export async function getUsableCategory(
  userId: string,
  categoryId: string,
  transactionType: "expense" | "income",
): Promise<CategoryRow> {
  const [category] = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        or(isNull(categories.userId), eq(categories.userId, userId)),
      ),
    )
    .limit(1);

  if (!category) {
    throw notFound("Kategori tidak ditemukan");
  }

  if (category.isArchived) {
    throw conflict("Kategori sudah diarsipkan dan tidak bisa dipakai");
  }

  if (
    category.type !== "both" &&
    category.type !== transactionType
  ) {
    throw conflict("Jenis transaksi tidak cocok dengan jenis kategori");
  }

  return category;
}

async function findDuplicate(input: {
  userId: string;
  name: string;
  type: CategoryType;
  excludeId?: string;
}): Promise<{ id: string; isArchived: boolean } | null> {
  const conditions = [
    or(isNull(categories.userId), eq(categories.userId, input.userId)),
    sql`lower(${categories.name}) = lower(${input.name})`,
    eq(categories.type, input.type),
  ];

  if (input.excludeId) {
    conditions.push(ne(categories.id, input.excludeId));
  }

  const [duplicate] = await db
    .select({ id: categories.id, isArchived: categories.isArchived })
    .from(categories)
    .where(and(...conditions))
    .limit(1);

  return duplicate ?? null;
}

export async function createCategory(
  userId: string,
  input: CreateCategoryInput,
): Promise<CategoryResponse> {
  const duplicate = await findDuplicate({
    userId,
    name: input.name,
    type: input.type,
  });

  if (duplicate) {
    throw conflict(
      duplicate.isArchived
        ? "Kategori dengan nama dan jenis tersebut sudah ada tetapi diarsipkan. Aktifkan kembali kategori lama."
        : "Kategori dengan nama dan jenis tersebut sudah ada",
      { categoryId: duplicate.id, isArchived: duplicate.isArchived },
    );
  }

  const values: NewCategory = {
    userId,
    name: input.name,
    type: input.type,
    icon: input.icon,
    color: input.color,
    isDefault: false,
    isArchived: false,
  };

  try {
    const [created] = await db
      .insert(categories)
      .values(values)
      .returning();
    return serializeCategory(created!, 0);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("Kategori dengan nama dan jenis tersebut sudah ada");
    }
    throw error;
  }
}

async function getOwnedCategory(
  userId: string,
  categoryId: string,
): Promise<CategoryRow> {
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  if (!category) {
    throw notFound("Kategori tidak ditemukan");
  }

  if (category.isDefault || category.userId === null) {
    throw forbidden("Kategori bawaan tidak bisa diubah atau dihapus");
  }

  if (category.userId !== userId) {
    throw notFound("Kategori tidak ditemukan");
  }

  return category;
}

export async function updateCategory(
  userId: string,
  categoryId: string,
  input: UpdateCategoryInput,
): Promise<CategoryResponse> {
  const existing = await getOwnedCategory(userId, categoryId);

  const nextName = input.name ?? existing.name;
  const nextType = input.type ?? existing.type;

  if (input.name !== undefined || input.type !== undefined) {
    const duplicate = await findDuplicate({
      userId,
      name: nextName,
      type: nextType,
      excludeId: categoryId,
    });
    if (duplicate) {
      throw conflict(
        "Kategori dengan nama dan jenis tersebut sudah ada",
        { categoryId: duplicate.id, isArchived: duplicate.isArchived },
      );
    }
  }

  if (input.type !== undefined && input.type !== existing.type) {
    const [usage] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.categoryId, categoryId),
        ),
      );

    if ((usage?.count ?? 0) > 0) {
      throw conflict(
        "Jenis kategori tidak bisa diubah karena sudah dipakai transaksi. Buat kategori baru dan pindahkan transaksi bila perlu.",
      );
    }
  }

  const updates: Partial<NewCategory> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.type !== undefined) updates.type = input.type;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.color !== undefined) updates.color = input.color;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  try {
    const [updated] = await db
      .update(categories)
      .set(updates)
      .where(
        and(eq(categories.id, categoryId), eq(categories.userId, userId)),
      )
      .returning();

    if (!updated) {
      throw notFound("Kategori tidak ditemukan");
    }

    const [usage] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.categoryId, categoryId),
        ),
      );

    return serializeCategory(updated, usage?.count ?? 0);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("Kategori dengan nama dan jenis tersebut sudah ada");
    }
    throw error;
  }
}

export async function deleteCategory(
  userId: string,
  categoryId: string,
): Promise<void> {
  await getOwnedCategory(userId, categoryId);

  const [usage] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.categoryId, categoryId),
      ),
    );

  if ((usage?.count ?? 0) > 0) {
    throw conflict(
      "Kategori masih dipakai transaksi sehingga tidak bisa dihapus. Arsipkan kategori ini sebagai gantinya.",
      { usageCount: usage?.count ?? 0 },
    );
  }

  const deleted = await db
    .delete(categories)
    .where(
      and(eq(categories.id, categoryId), eq(categories.userId, userId)),
    )
    .returning({ id: categories.id });

  if (deleted.length === 0) {
    throw notFound("Kategori tidak ditemukan");
  }
}
