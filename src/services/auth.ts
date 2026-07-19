import { requireSupabase } from '@/services/supabaseClient'
import { uploadAvatar } from '@/services/storage'
import { fetchProfileById, updateProfileRecord } from '@/services/profiles'
import { getAppUrl } from '@/utils/appUrl'
import type { CatProfile } from '@/types'

export interface SignUpInput {
  email: string
  password: string
  name: string
  breed: string
  age: number
  bio: string
  avatarFile?: File | null
}

export interface SignInInput {
  email: string
  password: string
}

export type SignUpResult =
  | { status: 'authenticated'; profile: CatProfile }
  | { status: 'verification_required'; email: string }

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const supabase = requireSupabase()
  const appUrl = getAppUrl()

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: `${appUrl}/auth`,
      data: {
        name: input.name.trim(),
        breed: input.breed.trim(),
        age: input.age,
        bio: input.bio.trim(),
      },
    },
  })

  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Signup failed — no user returned.')

  // Email confirmation enabled → no session until the user verifies
  if (!data.session) {
    return {
      status: 'verification_required',
      email: input.email.trim(),
    }
  }

  let avatarUrl: string | undefined
  if (input.avatarFile) {
    avatarUrl = await uploadAvatar(data.user.id, input.avatarFile)
  }

  await updateProfileRecord(data.user.id, {
    name: input.name.trim(),
    breed: input.breed.trim() || 'Mixed',
    age: input.age,
    bio: input.bio.trim(),
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  })

  return {
    status: 'authenticated',
    profile: await fetchProfileById(data.user.id),
  }
}

export async function signIn(input: SignInInput): Promise<CatProfile> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  })

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('email not confirmed')) {
      throw new Error(
        'Please verify your email before signing in. Check your inbox for the Catstagram activation link.',
      )
    }
    throw new Error(error.message)
  }
  if (!data.user) throw new Error('Sign in failed.')

  return fetchProfileById(data.user.id)
}

export async function signOut(): Promise<void> {
  const supabase = requireSupabase()
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function getSessionUserId(): Promise<string | null> {
  const supabase = requireSupabase()
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

export async function resetPasswordForEmail(email: string): Promise<void> {
  const supabase = requireSupabase()
  const appUrl = getAppUrl()

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${appUrl}/reset-password`,
  })

  if (error) throw new Error(error.message)
}

export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = requireSupabase()
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) throw new Error(error.message)
}
