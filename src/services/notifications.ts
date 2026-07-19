import { requireSupabase } from '@/services/supabaseClient'
import { mapNotification } from '@/services/mappers'
import { resolveUsername } from '@/utils/username'
import type { AppNotification, NotificationType } from '@/types'
import type { DbNotification, DbProfile } from '@/types/database'

type ActorLite = Pick<DbProfile, 'id' | 'name' | 'username' | 'avatar_url'>

async function fetchProfilesByIds(
  ids: string[],
): Promise<Map<string, ActorLite>> {
  const map = new Map<string, ActorLite>()
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return map

  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, username, avatar_url')
    .in('id', unique)

  if (error) {
    console.error('[notifications] actor profiles fetch failed', error)
    throw new Error(error.message)
  }

  for (const row of (data ?? []) as ActorLite[]) {
    map.set(row.id, row)
  }
  return map
}

/**
 * Two-step fetch: notifications rows only, then actor profiles by id.
 * Avoids fragile PostgREST relationship aliases on profiles.
 */
export async function fetchNotifications(
  userId: string,
): Promise<AppNotification[]> {
  const supabase = requireSupabase()
  const { data: notifs, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[notifications] fetch failed', error)
    throw new Error(error.message)
  }

  const rows = (notifs ?? []) as DbNotification[]
  const actors = await fetchProfilesByIds(rows.map((row) => row.actor_id))

  return rows.map((row) => mapNotification(row, actors.get(row.actor_id) ?? null))
}

export async function fetchNotificationById(
  id: string,
): Promise<AppNotification | null> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as DbNotification
  const actors = await fetchProfilesByIds([row.actor_id])
  return mapNotification(row, actors.get(row.actor_id) ?? null)
}

/** Mark all of the logged-in user's notifications as read (clears badge). */
export async function markNotificationsRead(userId: string): Promise<void> {
  const supabase = requireSupabase()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    console.error('[notifications] mark read failed', error)
    throw new Error(error.message)
  }
}

/**
 * Insert a notification for the recipient (`user_id`).
 * Skips self-actions (user_id === actor_id).
 */
export async function createNotification(input: {
  userId: string
  actorId: string
  type: NotificationType
  postId?: string | null
  conversationId?: string | null
  body?: string
}): Promise<void> {
  if (!input.userId || !input.actorId) return
  if (input.userId === input.actorId) return

  const supabase = requireSupabase()
  const payload = {
    user_id: input.userId,
    actor_id: input.actorId,
    type: input.type,
    post_id: input.postId ?? null,
    conversation_id: input.conversationId ?? null,
    body: (input.body ?? '').slice(0, 160),
    is_read: false,
  }

  const { error } = await supabase.from('notifications').insert(payload)

  if (error) {
    // Do not fail the parent action (like/comment/follow/DM) if notify insert fails.
    console.error('[notifications] insert failed', error, payload)
  }
}

export function subscribeToNotifications(
  userId: string,
  onChange: () => void,
  onInsert?: (notificationId: string) => void,
): () => void {
  const supabase = requireSupabase()
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT' && onInsert) {
          const row = payload.new as DbNotification
          onInsert(row.id)
        }
        onChange()
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export async function fetchActorUsername(userId: string): Promise<string> {
  const supabase = requireSupabase()
  const { data } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', userId)
    .maybeSingle()

  return resolveUsername(data?.username, userId)
}
