import { requireSupabase } from '@/services/supabaseClient'
import type { DbDailyReward } from '@/types/database'

export interface PostReward {
  streakDay: number
  coinsAwarded: number
}

/**
 * Bu post için sunucu tarafında (trigger) bir ödül tetiklendiyse döner.
 * Aynı gün ikinci bir post ödül tetiklemez, bu durumda null döner.
 */
export async function fetchPostReward(postId: string): Promise<PostReward | null> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('daily_rewards')
    .select('streak_day, coins_awarded')
    .eq('post_id', postId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as Pick<DbDailyReward, 'streak_day' | 'coins_awarded'>
  return { streakDay: row.streak_day, coinsAwarded: row.coins_awarded }
}
