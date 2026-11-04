const MAX_AMOUNT = 999_999_999_999.99;

/**
 * Mengubah nominal dari database (string numeric) menjadi number.
 * Aman untuk nilai NUMERIC(14,2) karena masih di bawah Number.MAX_SAFE_INTEGER
 * bila dihitung dalam satuan sen.
 */
export function toRupiah(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

/**
 * Menyimpan nominal sebagai string dengan 2 desimal agar PostgreSQL NUMERIC
 * tidak kehilangan presisi.
 */
export function toAmountString(value: number): string {
  return value.toFixed(2);
}

export function toCents(value: string | number): number {
  return Math.round(toRupiah(value) * 100);
}

export function centsToRupiah(cents: number): number {
  return Math.round(cents) / 100;
}

export function isValidRupiahAmount(value: number): boolean {
  if (!Number.isFinite(value) || value <= 0 || value > MAX_AMOUNT) return false;
  const cents = value * 100;
  return Math.abs(cents - Math.round(cents)) < 1e-6;
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 10_000) / 100;
}

export { MAX_AMOUNT };
