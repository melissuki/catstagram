/**
 * Map Auth / Supabase failures to short, human-readable copy.
 * Never surface stack traces or raw server dumps to the UI.
 */
export function toUserFacingError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!(error instanceof Error)) return fallback

  const raw = error.message?.trim() || ''
  const lower = raw.toLowerCase()

  if (
    error.name === 'UsernameTakenError' ||
    raw === 'USERNAME_TAKEN' ||
    lower.includes('already registered') ||
    lower.includes('user already exists')
  ) {
    return 'USERNAME_TAKEN'
  }

  if (lower.includes('username must be')) {
    return 'USERNAME_INVALID'
  }

  if (lower.includes('email not confirmed') || lower.includes('verify your email')) {
    return 'EMAIL_NOT_CONFIRMED'
  }

  if (
    lower.includes('invalid login') ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid email or password')
  ) {
    return 'INVALID_CREDENTIALS'
  }

  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'RATE_LIMITED'
  }

  if (
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('cannot reach supabase') ||
    (error as Error & { status?: number }).status === 404
  ) {
    return 'NETWORK'
  }

  if (lower.includes('not configured') || lower.includes('vite_supabase')) {
    return 'NOT_CONFIGURED'
  }

  // Drop stack-like / JSON / postgres internals
  if (
    raw.length > 160 ||
    lower.includes('stack') ||
    lower.includes('postgres') ||
    lower.includes('pgrst') ||
    raw.includes('\n')
  ) {
    return fallback
  }

  // Allow short, already-friendly messages through
  if (raw.length <= 120 && !/[{\\[]/.test(raw)) {
    return raw
  }

  return fallback
}
