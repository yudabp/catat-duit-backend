import { z } from "zod";
import { env } from "../config/env.js";

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
  .refine(isRealDate, "Tanggal tidak valid");

export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format bulan harus YYYY-MM");

export function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Tanggal hari ini menurut zona waktu aplikasi (default Asia/Jakarta). */
export function todayInAppTimeZone(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Gagal menentukan tanggal hari ini");
  }

  return `${year}-${month}-${day}`;
}

export function currentMonth(now = new Date()): string {
  return todayInAppTimeZone(now).slice(0, 7);
}

export function monthRange(month: string): { start: string; end: string } {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthNumber = Number(monthRaw);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function daysInMonth(month: string): string[] {
  const { start, end } = monthRange(month);
  const lastDay = Number(end.slice(8, 10));
  return Array.from(
    { length: lastDay },
    (_, index) =>
      `${month}-${String(index + 1).padStart(2, "0")}`,
  );
}

export function monthLabel(month: string): string {
  const [yearRaw, monthRaw] = month.split("-");
  const date = new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1, 1));
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function startOfMonth(month: string): string {
  return `${month}-01`;
}
