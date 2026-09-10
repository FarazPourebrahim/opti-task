/**
 * Parses a short duration string (`30s`, `15m`, `1h`, `7d`) into milliseconds.
 * Used to keep server-side session expiry aligned with the JWT TTLs configured
 * in env. Throws on an unrecognized format so misconfiguration fails loudly.
 */
const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function durationToMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  const amountStr = match?.[1];
  const unit = match?.[2];
  const unitMs = unit ? UNIT_MS[unit] : undefined;

  if (amountStr === undefined || unitMs === undefined) {
    throw new Error(`Invalid duration: "${value}" (expected e.g. 15m, 7d)`);
  }

  return Number(amountStr) * unitMs;
}
