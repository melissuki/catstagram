import type { CharacterSlot } from '@/character/catalog'

export interface ShopItem {
  id: string
  key: string
  slot: CharacterSlot
  price: number
}

/** An owned shop item, joined with its catalog entry. */
export interface InventoryItem {
  id: string
  itemKey: string
  acquiredAt: string
}

export interface DailyLoginResult {
  awarded: boolean
  coinsAwarded: number
  streakDay: number
  coins: number
}
