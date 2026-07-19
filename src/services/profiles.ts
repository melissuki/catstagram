import { requireSupabase } from '@/services/supabaseClient'
import { mapProfile } from '@/services/mappers'
import { uploadAvatar } from '@/services/storage'
import type { CatProfile } from '@/types'
import type { DbProfile } from '@/types/database'

async function withCounts(profile: DbProfile): Promise<CatProfile> {
  const supabase = requireSupabase()

  const [followersRes, followingRes, postsRes] = await Promise.all([
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profile.id),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', profile.id),
    supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id),
  ])

  return mapProfile(profile, {
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
    postsCount: postsRes.count ?? 0,
  })
}

export async function fetchProfileById(userId: string): Promise<CatProfile> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw new Error(error.message)
  return withCounts(data as DbProfile)
}

export async function updateProfileRecord(
  userId: string,
  updates: Partial<
    Pick<DbProfile, 'name' | 'breed' | 'age' | 'bio' | 'avatar_url'>
  >,
): Promise<void> {
  const supabase = requireSupabase()
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function updateMyProfile(
  userId: string,
  updates: {
    name: string
    breed: string
    age: number
    bio: string
    avatarFile?: File | null
  },
): Promise<CatProfile> {
  let avatar_url: string | undefined

  if (updates.avatarFile) {
    avatar_url = await uploadAvatar(userId, updates.avatarFile)
  }

  await updateProfileRecord(userId, {
    name: updates.name,
    breed: updates.breed,
    age: updates.age,
    bio: updates.bio,
    ...(avatar_url ? { avatar_url } : {}),
  })

  return fetchProfileById(userId)
}

export async function fetchSuggestedCats(currentUserId: string): Promise<CatProfile[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', currentUserId)
    .order('created_at', { ascending: false })
    .limit(12)

  if (error) throw new Error(error.message)

  return Promise.all((data as DbProfile[]).map((profile) => withCounts(profile)))
}

export async function fetchFollowingIds(userId: string): Promise<string[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.following_id as string)
}

export async function toggleFollow(
  currentUserId: string,
  targetUserId: string,
): Promise<boolean> {
  const supabase = requireSupabase()
  const { data: existing } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', currentUserId)
    .eq('following_id', targetUserId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId)
    if (error) throw new Error(error.message)
    return false
  }

  const { error } = await supabase.from('follows').insert({
    follower_id: currentUserId,
    following_id: targetUserId,
  })
  if (error) throw new Error(error.message)
  return true
}
