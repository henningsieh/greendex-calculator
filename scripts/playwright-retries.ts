export function playwrightRetries(value: string | undefined): number {
  if (value === undefined) return 0;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error("PLAYWRIGHT_RETRIES must be a non-negative safe integer.");
  }
  return Number(value);
}
