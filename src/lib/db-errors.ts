export function getPgErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return getPgErrorCode(error) === "23505";
}
