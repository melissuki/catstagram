import { AuthError } from '@supabase/supabase-js'
import { requireSupabase } from '@/services/supabaseClient'
import { fetchProfileById, isUsernameAvailable } from '@/services/profiles'
import { getAppUrl } from '@/utils/appUrl'
import { isValidUsername, normalizeUsername } from '@/utils/username'
import type { CatProfile } from '@/types'

export interface SignUpInput {
  email: string
  password: string
  username: string
  name: string
  breed: string
  age: number
  bio: string
  /** Ignored at signup when email confirmation is required — add photo after verify. */
  avatarFile?: File | null
}

export interface SignInInput {
  email: string
  password: string
}

export type SignUpResult = {
  status: 'verification_required'
  email: string
}

function logAuthError(scope: string, error: unknown) {
  if (error instanceof AuthError) {
    console.error(`[auth:${scope}]`, {
      message: error.message,
      status: error.status,
      code: error.code,
      name: error.name,
    })
    return
  }

  if (error instanceof Error) {
    console.error(`[auth:${scope}]`, {
      message: error.message,
      status: (error as Error & { status?: number }).status,
    })
    return
  }

  console.error(`[auth:${scope}]`, error)
}

/**
 * Sign-up is intentionally isolated:
 * - Only calls supabase.auth.signUp
 * - Stores cat profile fields in user_metadata (DB trigger creates profiles row)
 * - NEVER uploads images or updates profiles here (no session until email verify)
 */
export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const supabase = requireSupabase()
  const appUrl = getAppUrl()
  const email = input.email.trim()
  const username = normalizeUsername(input.username)

  if (!isValidUsername(username)) {
    throw new Error(
      'Username must be 3–24 characters: lowercase letters, numbers, underscore only (no spaces).',
    )
  }

  try {
    const available = await isUsernameAvailable(username)
    if (!available) {
      const err = new Error('USERNAME_TAKEN')
      err.name = 'UsernameTakenError'
      throw err
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        emailRedirectTo: `${appUrl}/auth`,
        data: {
          username,
          name: input.name.trim() || 'Cat',
          breed: input.breed.trim() || 'Mixed',
          age: input.age,
          bio: input.bio.trim(),
        },
      },
    })

    if (error) {
      logAuthError('signUp', error)
      throw new Error(error.message)
    }

    if (!data.user) {
      throw new Error('Signup failed — no user returned.')
    }

    // Existing account (Supabase returns user with empty identities)
    const identities = data.user.identities ?? []
    if (identities.length === 0) {
      throw new Error(
        'An account with this email already exists. Please sign in or check your inbox for the verification link.',
      )
    }

    // Email confirmation pending OR confirmed — never upload / write profile here.
    // Profile row is created by the `handle_new_user` DB trigger from metadata.
    console.info('[auth:signUp] success — verification email sent', {
      email,
      userId: data.user.id,
      hasSession: Boolean(data.session),
      emailConfirmedAt: data.user.email_confirmed_at,
    })

    // If a session slipped through, sign out so the app stays locked until verify + login
    if (data.session) {
      await supabase.auth.signOut()
    }

    return {
      status: 'verification_required',
      email,
    }
  } catch (error) {
    logAuthError('signUp:catch', error)
    throw error instanceof Error ? error : new Error('Signup failed')
  }
}

export async function signIn(input: SignInInput): Promise<CatProfile> {
  const supabase = requireSupabase()

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    })

    if (error) {
      logAuthError('signIn', error)
      const message = error.message.toLowerCase()
      if (message.includes('email not confirmed')) {
        throw new Error(
          'Please verify your email before signing in. Check your inbox for the Catstagram activation link.',
        )
      }
      if (
        error.status === 404 ||
        message.includes('failed to fetch') ||
        message.includes('networkerror')
      ) {
        throw new Error(
          'Cannot reach Supabase Auth (404/network). On Vercel, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then Redeploy.',
        )
      }
      throw new Error(error.message)
    }

    if (!data.user) throw new Error('Sign in failed.')
    if (!data.user.email_confirmed_at) {
      await supabase.auth.signOut()
      throw new Error(
        'Please verify your email before signing in. Check your inbox for the Catstagram activation link.',
      )
    }

    return fetchProfileById(data.user.id)
  } catch (error) {
    logAuthError('signIn:catch', error)
    throw error instanceof Error ? error : new Error('Sign in failed')
  }
}

export async function signOut(): Promise<void> {
  const supabase = requireSupabase()
  const { error } = await supabase.auth.signOut()
  if (error) {
    logAuthError('signOut', error)
    throw new Error(error.message)
  }
}

export async function getSessionUserId(): Promise<string | null> {
  const supabase = requireSupabase()
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

export async function resetPasswordForEmail(email: string): Promise<void> {
  const supabase = requireSupabase()
  const appUrl = getAppUrl()

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${appUrl}/reset-password`,
    })
    if (error) {
      logAuthError('resetPasswordForEmail', error)
      throw new Error(error.message)
    }
  } catch (error) {
    logAuthError('resetPasswordForEmail:catch', error)
    throw error instanceof Error ? error : new Error('Password reset failed')
  }
}

export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = requireSupabase()

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })
    if (error) {
      logAuthError('updatePassword', error)
      throw new Error(error.message)
    }
  } catch (error) {
    logAuthError('updatePassword:catch', error)
    throw error instanceof Error ? error : new Error('Password update failed')
  }
}
