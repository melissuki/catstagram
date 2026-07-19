import { requireSupabase } from '@/services/supabaseClient'
import { mapProfile } from '@/services/mappers'
import { uploadAvatar } from '@/services/storage'
import { createNotification } from '@/services/notifications'
import { isValidUsername, normalizeUsername } from '@/utils/username'
import { sanitizeUserText } from '@/utils/sanitize'
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

export async function fetchProfileByUsername(
  username: string,
): Promise<CatProfile> {
  const supabase = requireSupabase()
  const normalized = normalizeUsername(username)
  if (!normalized) throw new Error('Invalid username')

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', normalized)
    .single()

  if (error) throw new Error(error.message)
  return withCounts(data as DbProfile)
}

function escapeIlike(value: string): string {
  return value.replace(/[%_,]/g, '')
}

/**
 * Live username/name search. Always excludes the logged-in user.
 * Matches: `.neq('id', currentUser.id).ilike('username', %q%)` (+ name).
 */
export async function searchProfilesByUsername(
  query: string,
  excludeUserId?: string,
): Promise<CatProfile[]> {
  const supabase = requireSupabase()
  const raw = query.trim().toLowerCase().replace(/^@+/, '')
  const usernamePart = escapeIlike(normalizeUsername(raw))
  const namePart = escapeIlike(raw)

  if (usernamePart.length < 1 && namePart.length < 1) return []

  let request = supabase.from('profiles').select('*').limit(24)

  if (excludeUserId) {
    request = request.neq('id', excludeUserId)
  }

  if (usernamePart && namePart && usernamePart !== namePart) {
    request = request.or(
      `username.ilike.%${usernamePart}%,name.ilike.%${namePart}%`,
    )
  } else if (usernamePart) {
    request = request.ilike('username', `%${usernamePart}%`)
  } else {
    request = request.ilike('name', `%${namePart}%`)
  }

  request = request.order('username', { ascending: true })

  const { data, error } = await request
  if (error) throw new Error(error.message)

  return Promise.all((data as DbProfile[]).map((profile) => withCounts(profile)))
}

export async function isUsernameAvailable(
  username: string,
  excludeUserId?: string,
): Promise<boolean> {
  if (!isValidUsername(username)) return false
  const supabase = requireSupabase()
  let request = supabase
    .from('profiles')
    .select('id')
    .eq('username', username)

  if (excludeUserId) {
    request = request.neq('id', excludeUserId)
  }

  const { data, error } = await request.maybeSingle()
  if (error) throw new Error(error.message)
  return !data
}

export async function updateProfileRecord(
  userId: string,
  // Güvenlik (VULN-02): food_streak / last_fed_date / game_high_score
  // buradan yazılamaz. Bunlar yalnızca sunucudaki RPC'ler üzerinden
  // güncellenir (update_game_high_score, feed_cat) ve DB'de bu kolonlara
  // doğrudan UPDATE izni kaldırılmıştır.
  updates: Partial<
    Pick<
      DbProfile,
      'name' | 'breed' | 'age' | 'bio' | 'avatar_url' | 'username'
    >
  >,
): Promise<void> {
  const supabase = requireSupabase()
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function updateMyProfile(
  userId: string,
  updates: {
    name: string
    breed: string
    age: number
    bio: string
    username?: string
    avatarFile?: File | null
  },
): Promise<CatProfile> {
  let avatar_url: string | undefined
  let username: string | undefined

  if (updates.avatarFile) {
    avatar_url = await uploadAvatar(userId, updates.avatarFile)
  }

  if (updates.username !== undefined) {
    username = normalizeUsername(updates.username)
    if (!isValidUsername(username)) {
      throw new Error('USERNAME_INVALID')
    }
    const available = await isUsernameAvailable(username, userId)
    if (!available) {
      const err = new Error('USERNAME_TAKEN')
      err.name = 'UsernameTakenError'
      throw err
    }
  }

  await updateProfileRecord(userId, {
    name: sanitizeUserText(updates.name, 80),
    breed: sanitizeUserText(updates.breed, 80),
    age: updates.age,
    bio: sanitizeUserText(updates.bio, 500),
    ...(avatar_url ? { avatar_url } : {}),
    ...(username ? { username } : {}),
  })

  return fetchProfileById(userId)
}

/**
 * Persist Treat Catcher high score for the authenticated user only.
 * Güvenlik (VULN-02): Skor artık doğrudan tabloya yazılmaz. Sunucudaki
 * SECURITY DEFINER fonksiyonu `update_game_high_score` çağrılır; fonksiyon
 * skoru doğrular (negatif/üst sınır kontrolü) ve yalnızca mevcut rekorun
 * üzerindeyse günceller. İstemciden 999999 gibi keyfi bir değer PATCH ile
 * yazılamaz.
 */
export async function updateGameHighScore(
  userId: string,
  score: number,
): Promise<{ profile: CatProfile; isNewHigh: boolean }> {
  const supabase = requireSupabase()
  const previous = await fetchProfileById(userId)

  const { data, error } = await supabase.rpc('update_game_high_score', {
    new_score: score,
  })
  if (error) throw new Error(error.message)

  const profile = await fetchProfileById(userId)
  const isNewHigh = (data as number) > previous.gameHighScore
  return { profile, isNewHigh }
}

/**
 * Bugün kediyi besle (mama serisi). Güvenlik (VULN-02): food_streak
 * sunucuda, son besleme tarihine göre HESAPLANIR; istemci değeri kendisi
 * belirleyemez. Sadece "besle" komutu gönderir.
 */
export async function feedCat(userId: string): Promise<CatProfile> {
  const supabase = requireSupabase()
  const { error } = await supabase.rpc('feed_cat')
  if (error) throw new Error(error.message)
  return fetchProfileById(userId)
}

export async function fetchSuggestedCats(
  currentUserId: string,
): Promise<CatProfile[]> {
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
  if (currentUserId === targetUserId) {
    throw new Error('Cannot follow yourself')
  }

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

  await createNotification({
    userId: targetUserId,
    actorId: currentUserId,
    type: 'follow',
  })

  return true
}
