import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Vite only exposes env vars prefixed with `VITE_`.
 * On Vercel: Project Settings → Environment Variables → set both, then Redeploy.
 */
const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Strip whitespace, accidental quotes from dashboards, and trailing slashes. */
function normalizeSupabaseUrl(value: string | undefined): string {
  if (!value) return ''
  return value
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/\/+$/, '')
}

function normalizeAnonKey(value: string | undefined): string {
  if (!value) return ''
  return value.trim().replace(/^["']+|["']+$/g, '')
}

const supabaseUrl = normalizeSupabaseUrl(rawUrl)
const supabaseAnonKey = normalizeAnonKey(rawAnonKey)

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase URL or Anon Key is missing in environment variables!',
    {
      hasUrl: Boolean(supabaseUrl),
      hasAnonKey: Boolean(supabaseAnonKey),
      hint: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy.',
    },
  )
}

const looksConfigured =
  Boolean(supabaseUrl && supabaseAnonKey) &&
  !supabaseUrl.includes('YOUR_PROJECT_REF') &&
  !supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY') &&
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)

export const isSupabaseConfigured = looksConfigured

/**
 * Central Supabase client used by Auth, Database, Storage, and Realtime.
 * Never call createClient with empty values — that makes auth hit the Vercel
 * origin (relative URL) and return 404.
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
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Vite prefix required), then restart locally or Redeploy on Vercel.',
    )
  }
  return supabase
}

export default supabase
