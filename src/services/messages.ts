import { requireSupabase } from '@/lib/supabase'
import { mapConversation, mapMessage, mapProfile } from '@/services/mappers'
import type { Conversation, Message } from '@/types'
import type { DbMessage, DbProfile } from '@/types/database'

export async function fetchConversations(
  currentUserId: string,
): Promise<Conversation[]> {
  const supabase = requireSupabase()

  const { data: memberships, error: memberError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', currentUserId)

  if (memberError) throw new Error(memberError.message)

  const conversationIds = (memberships ?? []).map(
    (row) => row.conversation_id as string,
  )

  if (conversationIds.length === 0) return []

  const { data: memberRows, error: peersError } = await supabase
    .from('conversation_members')
    .select('conversation_id, user_id')
    .in('conversation_id', conversationIds)

  if (peersError) throw new Error(peersError.message)

  const peerIds = [
    ...new Set(
      (memberRows ?? [])
        .filter((row) => row.user_id !== currentUserId)
        .map((row) => row.user_id as string),
    ),
  ]

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', peerIds.length ? peerIds : ['00000000-0000-0000-0000-000000000000'])

  if (profilesError) throw new Error(profilesError.message)

  const profileMap = new Map(
    ((profiles ?? []) as DbProfile[]).map((profile) => [
      profile.id,
      mapProfile(profile),
    ]),
  )

  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('*')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true })

  if (messagesError) throw new Error(messagesError.message)

  const messagesByConversation = new Map<string, Message[]>()
  for (const row of (messages ?? []) as DbMessage[]) {
    const list = messagesByConversation.get(row.conversation_id) ?? []
    list.push(mapMessage(row))
    messagesByConversation.set(row.conversation_id, list)
  }

  const conversations: Conversation[] = []

  for (const conversationId of conversationIds) {
    const peerId = (memberRows ?? []).find(
      (row) =>
        row.conversation_id === conversationId && row.user_id !== currentUserId,
    )?.user_id as string | undefined

    if (!peerId) continue
    const participant = profileMap.get(peerId)
    if (!participant) continue

    conversations.push(
      mapConversation({
        id: conversationId,
        participant,
        messages: messagesByConversation.get(conversationId) ?? [],
      }),
    )
  }

  return conversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export async function getOrCreateConversation(
  _currentUserId: string,
  friendId: string,
): Promise<string> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('create_conversation_with', {
    friend_id: friendId,
  })

  if (error) throw new Error(error.message)
  return data as string
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
): Promise<Message> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: text.trim(),
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return mapMessage(data as DbMessage)
}

export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: Message) => void,
) {
  const supabase = requireSupabase()

  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onMessage(mapMessage(payload.new as DbMessage))
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
