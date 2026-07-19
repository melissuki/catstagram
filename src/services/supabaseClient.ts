import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !String(supabaseUrl).includes('YOUR_PROJECT_REF') &&
    !String(supabaseAnonKey).includes('YOUR_SUPABASE_ANON_KEY'),
)

/**
 * Central Supabase client used by Auth, Database, Storage, and Realtime.
 * Env vars come from `.env` / Vercel: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 */
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : (null as unknown as SupabaseClient)

export function requireSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, then restart the Vite dev server.',
    )
  }
  return supabase
}

export default supabase
