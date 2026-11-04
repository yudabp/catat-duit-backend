const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

/** Mencegah CSV/formula injection saat file dibuka di Excel/Sheets. */
function sanitizeText(value: string): string {
  const firstSignificant = value.trimStart()[0];
  if (firstSignificant && FORMULA_PREFIXES.has(firstSignificant)) {
    return `'${value}`;
  }
  return value;
}

export function csvCell(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "string" ? sanitizeText(value) : String(value);

  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

export function csvRow(values: Array<string | number | null | undefined>): string {
  return values.map(csvCell).join(",");
}
