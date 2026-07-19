/** Lowercase letters, numbers, underscore — 3 to 24 chars. */
export const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/

export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9_]/g, '')
}

export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username)
}

/** Stable display handle when DB username is missing (never shared `@cat`). */
export function resolveUsername(
  username: string | null | undefined,
  userId: string,
): string {
  const normalized = username ? normalizeUsername(username) : ''
  if (normalized.length >= 3) return normalized
  return `user_${userId.replace(/-/g, '').slice(0, 8)}`
}

export function profilePath(userId: string): string {
  return `/profile/${userId}`
}
