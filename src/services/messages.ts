import { requireSupabase } from '@/services/supabaseClient'
import { mapConversation, mapMessage, mapProfile } from '@/services/mappers'
import { createNotification } from '@/services/notifications'
import { fetchProfileById } from '@/services/profiles'
import type { Conversation, Message } from '@/types'
import type { DbMessage, DbProfile } from '@/types/database'

function peerIdFor(row: DbMessage, currentUserId: string): string {
  return row.sender_id === currentUserId ? row.receiver_id : row.sender_id
}

async function fetchProfilesByIds(
  ids: string[],
): Promise<Map<string, DbProfile>> {
  const map = new Map<string, DbProfile>()
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return map

  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', unique)

  if (error) {
    console.error('[messages] peer profiles fetch failed', error)
    throw new Error(error.message)
  }

  for (const row of (data ?? []) as DbProfile[]) {
    map.set(row.id, row)
  }
  return map
}

/**
 * Conversation list via two-step fetch (no profile joins):
 * 1) all messages involving the current user
 * 2) partner profiles by id
 */
export async function fetchConversations(
  currentUserId: string,
): Promise<Conversation[]> {
  const supabase = requireSupabase()

  const { data: allMsgs, error } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[messages] fetch conversations failed', error)
    throw new Error(error.message)
  }

  const rows = (allMsgs ?? []) as DbMessage[]
  const byPeer = new Map<string, Message[]>()

  for (const row of rows) {
    const peer = peerIdFor(row, currentUserId)
    if (!peer || peer === currentUserId) continue
    const list = byPeer.get(peer) ?? []
    list.push(mapMessage(row))
    byPeer.set(peer, list)
  }

  const peerProfiles = await fetchProfilesByIds([...byPeer.keys()])

  const conversations: Conversation[] = []
  for (const [peer, messages] of byPeer) {
    const profile = peerProfiles.get(peer)
    if (!profile) continue
    conversations.push(
      mapConversation({
        participant: mapProfile(profile),
        messages,
      }),
    )
  }

  return conversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

/** Full chronological thread between two users (plain select, no joins). */
export async function fetchThread(
  currentUserId: string,
  targetUserId: string,
): Promise<Message[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`,
    )
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[messages] fetch thread failed', error)
    throw new Error(error.message)
  }
  return ((data ?? []) as DbMessage[]).map(mapMessage)
}

/** Open (or create empty) chat with a peer — thread id is the peer's user id. */
export async function getOrCreateConversation(
  currentUserId: string,
  friendId: string,
): Promise<string> {
  if (!friendId) throw new Error('Missing friend id')
  if (friendId === currentUserId) throw new Error('Cannot chat with yourself')
  await fetchProfileById(friendId)
  return friendId
}

/** Return inbox list entry for a peer, creating an empty shell if none yet. */
export async function ensureConversation(
  currentUserId: string,
  friendId: string,
): Promise<Conversation> {
  const profile = await fetchProfileById(friendId)
  const thread = await fetchThread(currentUserId, friendId)
  return mapConversation({ participant: profile, messages: thread })
}

export async function sendMessage(
  receiverId: string,
  senderId: string,
  text: string,
): Promise<Message> {
  const supabase = requireSupabase()
  const content = text.trim()
  if (!content) throw new Error('Message is empty')
  if (receiverId === senderId) throw new Error('Cannot message yourself')

  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      content,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  const message = mapMessage(data as DbMessage)

  await createNotification({
    userId: receiverId,
    actorId: senderId,
    type: 'message',
  })

  return message
}

export function subscribeToMessages(
  peerId: string,
  currentUserId: string,
  onMessage: (message: Message) => void,
) {
  const supabase = requireSupabase()

  const channel = supabase
    .channel(`dm-thread:${currentUserId}:${peerId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        const row = payload.new as DbMessage
        const involvesPair =
          (row.sender_id === currentUserId && row.receiver_id === peerId) ||
          (row.sender_id === peerId && row.receiver_id === currentUserId)
        if (involvesPair) onMessage(mapMessage(row))
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

/** Global DM listener for inbox previews + toasts. */
export function subscribeToAllMessages(
  currentUserId: string,
  onMessage: (message: Message) => void,
) {
  const supabase = requireSupabase()

  const channel = supabase
    .channel(`dm-global:${currentUserId}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        const row = payload.new as DbMessage
        if (row.sender_id === currentUserId || row.receiver_id === currentUserId) {
          onMessage(mapMessage(row))
        }
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export function subscribeToFeed(onChange: () => void) {
  const supabase = requireSupabase()

  const channel = supabase
    .channel('feed-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'posts' },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'likes' },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'comments' },
      () => onChange(),
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
