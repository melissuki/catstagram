/**
 * Columns the app reads from `profiles`. Never use select('*') on profiles:
 * private columns (e.g. last login date) are not readable by clients, and a
 * wildcard select would fail. Keep in sync with security_hardening_v3.sql.
 */
export const PROFILE_COLUMNS =
  'id, username, name, breed, age, bio, avatar_url, game_high_score, coins, post_streak_count, post_streak_last_date, login_streak_count, avatar_config, created_at, updated_at'
