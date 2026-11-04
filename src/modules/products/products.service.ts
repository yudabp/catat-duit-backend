import { and, asc, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { products, type NewProduct, type Product } from "../../db/schema.js";
import { isUniqueViolation } from "../../lib/db-errors.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { toAmountString, toRupiah } from "../../lib/money.js";
import type {
  AdjustStockInput,
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
} from "./products.schemas.js";

export type ProductResponse = {
  id: string;
  name: string;
  cost: number;
  price: number;
  stock: number;
  profitPerUnit: number;
  marginPercent: number;
  createdAt: string;
  updatedAt: string;
};

export function serializeProduct(row: Product): ProductResponse {
  const cost = toRupiah(row.cost);
  const price = toRupiah(row.price);
  const stock = Number(row.stock);
  const profitPerUnit = price - cost;
  const marginPercent =
    cost > 0 ? Math.round((profitPerUnit / cost) * 100) : 0;

  return {
    id: row.id,
    name: row.name,
    cost,
    price,
    stock,
    profitPerUnit,
    marginPercent,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type PaginatedProducts = {
  data: ProductResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export async function getProduct(
  userId: string,
  productId: string,
): Promise<ProductResponse> {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .limit(1);

  if (!row) throw notFound("Produk tidak ditemukan");
  return serializeProduct(row);
}

export async function createProduct(
  userId: string,
  input: CreateProductInput,
): Promise<ProductResponse> {
  const [existing] = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.userId, userId),
        sql`lower(${products.name}) = lower(${input.name})`,
      ),
    )
    .limit(1);

  if (existing) {
    throw conflict(`Produk "${input.name}" sudah ada.`);
  }

  const values: NewProduct = {
    userId,
    name: input.name,
    cost: toAmountString(input.cost),
    price: toAmountString(input.price),
    stock: String(input.stock),
  };

  try {
    const [row] = await db.insert(products).values(values).returning();
    return serializeProduct(row!);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(`Produk "${input.name}" sudah ada.`);
    }
    throw error;
  }
}

export async function updateProduct(
  userId: string,
  productId: string,
  input: UpdateProductInput,
): Promise<ProductResponse> {
  const [existing] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .limit(1);

  if (!existing) {
    throw notFound("Produk tidak ditemukan");
  }

  if (
    input.name &&
    input.name.toLowerCase() !== existing.name.toLowerCase()
  ) {
    const [duplicate] = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.userId, userId),
          sql`lower(${products.name}) = lower(${input.name})`,
        ),
      )
      .limit(1);

    if (duplicate) {
      throw conflict(`Produk dengan nama "${input.name}" sudah ada.`);
    }
  }

  const updates: Partial<NewProduct> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.cost !== undefined) updates.cost = toAmountString(input.cost);
  if (input.price !== undefined) updates.price = toAmountString(input.price);
  if (input.stock !== undefined) updates.stock = String(input.stock);

  try {
    const [row] = await db
      .update(products)
      .set(updates)
      .where(and(eq(products.id, productId), eq(products.userId, userId)))
      .returning();

    return serializeProduct(row!);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(`Produk dengan nama "${input.name}" sudah ada.`);
    }
    throw error;
  }
}

export async function adjustProductStock(
  userId: string,
  productId: string,
  input: AdjustStockInput,
): Promise<ProductResponse> {
  const [existing] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .limit(1);

  if (!existing) {
    throw notFound("Produk tidak ditemukan");
  }

  const currentStock = Number(existing.stock);
  const nextStock = currentStock + input.delta;

  if (nextStock < 0) {
    throw badRequest(
      `Stok tidak mencukupi (sisa ${currentStock}, pengurangan ${Math.abs(input.delta)}).`,
    );
  }

  const updates: Partial<NewProduct> = {
    stock: String(nextStock),
    updatedAt: new Date(),
  };
  if (input.cost !== undefined) {
    updates.cost = toAmountString(input.cost);
  }

  const [row] = await db
    .update(products)
    .set(updates)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .returning();

  return serializeProduct(row!);
}

export async function deleteProduct(
  userId: string,
  productId: string,
): Promise<void> {
  const deleted = await db
    .delete(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .returning({ id: products.id });

  if (deleted.length === 0) {
    throw notFound("Produk tidak ditemukan");
  }
}

export async function listProducts(
  userId: string,
  query: ListProductsQuery,
): Promise<PaginatedProducts> {
  const filters: SQL[] = [eq(products.userId, userId)];

  if (query.search) {
    filters.push(ilike(products.name, `%${query.search}%`));
  }

  const where = and(...filters);
  const offset = (query.page - 1) * query.limit;

  let orderBy: SQL;
  switch (query.sort) {
    case "name_desc":
      orderBy = desc(products.name);
      break;
    case "stock_asc":
      orderBy = asc(products.stock);
      break;
    case "stock_desc":
      orderBy = desc(products.stock);
      break;
    case "created_desc":
      orderBy = desc(products.createdAt);
      break;
    case "name_asc":
    default:
      orderBy = asc(products.name);
      break;
  }

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(orderBy)
      .limit(query.limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(where),
  ]);

  const total = countRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / query.limit));

  return {
    data: rows.map(serializeProduct),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
      hasNextPage: offset + rows.length < total,
      hasPreviousPage: query.page > 1,
    },
  };
}
