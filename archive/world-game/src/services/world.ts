import { requireSupabase } from '@/services/supabaseClient'
import { sanitizeUserText } from '@/utils/sanitize'
import type { DbPlayerPosition } from '@/types/database'

export interface PlayerPosition {
  id: number
  userId: string
  playerName: string
  worldX: number
  worldY: number
  petKey: string
  petTint: string
  updatedAt: string
}

export interface WorldChatMessage {
  id: string
  userId: string
  playerName: string
  content: string
  createdAt: string
}

/** Permanent house plot — survives logout / leaveWorld. */
export interface WorldHome {
  userId: string
  playerName: string
  slotIndex: number
  plotX: number
  plotY: number
}

const INACTIVE_MS = 45_000

function mapRow(row: DbPlayerPosition): PlayerPosition {
  return {
    id: row.id,
    userId: row.user_id,
    playerName: row.player_name,
    worldX: row.world_x,
    worldY: row.world_y,
    petKey: row.pet_key ?? 'mochi',
    petTint: row.pet_tint ?? 'none',
    updatedAt: row.updated_at,
  }
}

function isActive(updatedAt: string, now = Date.now()): boolean {
  const ts = new Date(updatedAt).getTime()
  if (Number.isNaN(ts)) return false
  return now - ts <= INACTIVE_MS
}

export async function updatePlayerPosition(
  playerName: string,
  worldX: number,
  worldY: number,
  petKey = 'mochi',
  petTint = 'none',
): Promise<PlayerPosition> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('upsert_player_position', {
    p_player_name: playerName,
    p_world_x: worldX,
    p_world_y: worldY,
    p_pet_key: petKey,
    p_pet_tint: petTint,
  })

  if (error) {
    // Fallback to 3-arg RPC if migration not fully applied
    const retry = await supabase.rpc('upsert_player_position', {
      p_player_name: playerName,
      p_world_x: worldX,
      p_world_y: worldY,
    })
    if (retry.error) {
      if (
        error.message.includes('upsert_player_position') ||
        error.code === 'PGRST202'
      ) {
        throw new Error(
          'Could not find upsert_player_position. Run add_world_multiplayer.sql and fix_room_starters_and_world_features.sql in Supabase.',
        )
      }
      throw new Error(retry.error.message)
    }
    return mapRow(retry.data as DbPlayerPosition)
  }

  return mapRow(data as DbPlayerPosition)
}

export async function fetchActivePlayers(
  myUserId: string,
): Promise<PlayerPosition[]> {
  const supabase = requireSupabase()
  // Only fetch rows that can still be active instead of the whole table
  const cutoff = new Date(Date.now() - INACTIVE_MS).toISOString()
  const { data, error } = await supabase
    .from('player_positions')
    .select('*')
    .neq('user_id', myUserId)
    .gte('updated_at', cutoff)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)

  const now = Date.now()
  return ((data ?? []) as DbPlayerPosition[])
    .map(mapRow)
    .filter((player) => isActive(player.updatedAt, now))
}

export async function leaveWorld(): Promise<void> {
  const supabase = requireSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  // Only clear live presence — world_homes stay forever
  const { error } = await supabase
    .from('player_positions')
    .delete()
    .eq('user_id', user.id)

  if (error) console.error('[world] leaveWorld failed', error)
}

export async function claimWorldHome(playerName: string): Promise<WorldHome> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('claim_world_home', {
    p_player_name: playerName,
  })
  if (error) throw new Error(error.message)
  const row = data as {
    user_id: string
    player_name: string
    slot_index: number
    plot_x: number
    plot_y: number
  }
  return {
    userId: row.user_id,
    playerName: row.player_name,
    slotIndex: row.slot_index,
    plotX: row.plot_x,
    plotY: row.plot_y,
  }
}

export async function fetchWorldHomes(): Promise<WorldHome[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('world_homes')
    .select('*')
    .order('slot_index', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as Array<{
    user_id: string
    player_name: string
    slot_index: number
    plot_x: number
    plot_y: number
  }>).map((row) => ({
    userId: row.user_id,
    playerName: row.player_name,
    slotIndex: row.slot_index,
    plotX: row.plot_x,
    plotY: row.plot_y,
  }))
}

export function subscribeToWorldHomes(
  callback: (homes: WorldHome[]) => void,
): () => void {
  const supabase = requireSupabase()
  const channel = supabase
    .channel(`world_homes:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'world_homes' },
      () => {
        void fetchWorldHomes()
          .then(callback)
          .catch((error) => console.error('[world] homes sub', error))
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export function subscribeToPlayerPositions(
  myUserId: string,
  callback: (players: PlayerPosition[]) => void,
): () => void {
  const supabase = requireSupabase()

  const channel = supabase
    .channel(`player_positions:${myUserId}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'player_positions' },
      () => {
        void fetchActivePlayers(myUserId)
          .then(callback)
          .catch((error) => console.error('[world] positions sub', error))
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export async function sendWorldChat(
  playerName: string,
  content: string,
): Promise<WorldChatMessage> {
  const supabase = requireSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const clean = sanitizeUserText(content, 120)
  if (!clean) throw new Error('Message is empty')

  const { data, error } = await supabase
    .from('world_chat_messages')
    .insert({
      user_id: user.id,
      player_name: playerName,
      content: clean,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  return {
    id: data.id,
    userId: data.user_id,
    playerName: data.player_name,
    content: data.content,
    createdAt: data.created_at,
  }
}

export async function fetchRecentWorldChat(
  limit = 30,
): Promise<WorldChatMessage[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('world_chat_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return ((data ?? []) as Array<{
    id: string
    user_id: string
    player_name: string
    content: string
    created_at: string
  }>)
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      playerName: row.player_name,
      content: row.content,
      createdAt: row.created_at,
    }))
    .reverse()
}

export function subscribeToWorldChat(
  onMessage: (message: WorldChatMessage) => void,
): () => void {
  const supabase = requireSupabase()
  const channel = supabase
    .channel(`world_chat:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'world_chat_messages',
      },
      (payload) => {
        const row = payload.new as {
          id: string
          user_id: string
          player_name: string
          content: string
          created_at: string
        }
        onMessage({
          id: row.id,
          userId: row.user_id,
          playerName: row.player_name,
          content: row.content,
          createdAt: row.created_at,
        })
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
