/** Cat age in whole years, clamped to what the database accepts (0–40). */
export function clampAge(value: unknown, fallback = 1): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isFinite(n)) return fallback
  return Math.min(40, Math.max(0, Math.round(n)))
}
