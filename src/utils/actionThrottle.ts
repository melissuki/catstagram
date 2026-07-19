const lastActionAt = new Map<string, number>()

/** Default cooldown for interactive writes (like / comment / DM). */
export const ACTION_COOLDOWN_MS = 1500

/**
 * Returns true if the action is allowed; false if still in cooldown.
 * Scoped by key so different actions don't block each other.
 */
export function tryAction(
  key: string,
  cooldownMs: number = ACTION_COOLDOWN_MS,
): boolean {
  const now = Date.now()
  const last = lastActionAt.get(key) ?? 0
  if (now - last < cooldownMs) return false
  lastActionAt.set(key, now)
  return true
}
