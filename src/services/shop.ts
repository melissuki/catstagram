import { requireSupabase } from '@/services/supabaseClient'
import { isCharacterSlot, isDrawable } from '@/character/catalog'
import type { AvatarConfig } from '@/types/avatar'
import type { DbShopItem } from '@/types/database'
import type { DailyLoginResult, InventoryItem, ShopItem } from '@/types/shop'

/**
 * Active character items this client knows how to draw, cheapest first.
 * Old furniture rows are inactive and filtered out server-side.
 */
export async function fetchShopItems(): Promise<ShopItem[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('shop_items')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as DbShopItem[]).flatMap((row): ShopItem[] => {
    if (!isCharacterSlot(row.category) || !isDrawable(row.category, row.key)) return []
    return [{ id: row.id, key: row.key, slot: row.category, price: row.price }]
  })
}

export async function fetchMyInventory(userId: string): Promise<InventoryItem[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, acquired_at, shop_items(key)')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  type Row = { id: string; acquired_at: string; shop_items: { key: string } | null }
  return ((data ?? []) as unknown as Row[]).flatMap((row) =>
    row.shop_items
      ? [{ id: row.id, itemKey: row.shop_items.key, acquiredAt: row.acquired_at }]
      : [],
  )
}

/**
 * Buys an item with coins. Coin check, debit and inventory insert happen
 * atomically in the `purchase_item` RPC, so the client can't fake a purchase.
 */
export async function purchaseItem(itemKey: string): Promise<void> {
  const supabase = requireSupabase()
  const { error } = await supabase.rpc('purchase_item', { item_key: itemKey })
  if (error) throw new Error(error.message)
}

/** Saves the equipped items. The server rejects items the user doesn't own. */
export async function equipCharacter(config: AvatarConfig): Promise<void> {
  const supabase = requireSupabase()
  const { error } = await supabase.rpc('equip_character', { p_config: config })
  if (error) throw new Error(error.message)
}

/** Grants today's login coins once per day (server decides). */
export async function claimDailyLogin(): Promise<DailyLoginResult> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('claim_daily_login')
  if (error) throw new Error(error.message)
  const row = (data ?? {}) as {
    awarded?: boolean
    coins_awarded?: number
    streak_day?: number
    coins?: number
  }
  return {
    awarded: row.awarded === true,
    coinsAwarded: row.coins_awarded ?? 0,
    streakDay: row.streak_day ?? 0,
    coins: row.coins ?? 0,
  }
}
