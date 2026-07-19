import { requireSupabase } from '@/lib/supabase'
import { uploadAvatar } from '@/services/storage'
import { fetchProfileById, updateProfileRecord } from '@/services/profiles'
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

export async function signUp(input: SignUpInput): Promise<CatProfile> {
  const supabase = requireSupabase()

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
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

  let avatarUrl = ''
  if (input.avatarFile) {
    avatarUrl = await uploadAvatar(data.user.id, input.avatarFile)
    await updateProfileRecord(data.user.id, {
      name: input.name.trim(),
      breed: input.breed.trim(),
      age: input.age,
      bio: input.bio.trim(),
      avatar_url: avatarUrl,
    })
  }

  // Session may be null if email confirmation is required
  if (!data.session) {
    throw new Error(
      'Account created. Confirm your email in Supabase Auth settings (or disable email confirmation), then sign in.',
    )
  }

  return fetchProfileById(data.user.id)
}

export async function signIn(input: SignInInput): Promise<CatProfile> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  })

  if (error) throw new Error(error.message)
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
