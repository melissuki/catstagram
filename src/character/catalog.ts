/**
 * Client-side drawing catalog for the cat character. Prices and ownership
 * live in the database (`shop_items`); this file only knows how to draw each
 * item. Keep the keys in sync with
 * supabase/migrations/character_shop_and_daily_login.sql.
 */

export type CharacterSlot = 'fur' | 'eyes' | 'hat' | 'glasses' | 'neck' | 'background'

export const CHARACTER_SLOTS: readonly CharacterSlot[] = [
  'fur',
  'eyes',
  'hat',
  'glasses',
  'neck',
  'background',
]

/** Slots that must always have an item equipped. */
export const REQUIRED_SLOTS: readonly CharacterSlot[] = ['fur', 'eyes', 'background']

export type CharacterConfig = Record<CharacterSlot, string | null>

export const DEFAULT_CHARACTER: CharacterConfig = {
  fur: 'fur_orange',
  eyes: 'eyes_round',
  hat: null,
  glasses: null,
  neck: null,
  background: 'bg_peach',
}

export interface FurStyle {
  body: string
  outline: string
  innerEar: string
  /** Eye color that stays visible on this fur. */
  eye: string
}

export const FUR_STYLES: Record<string, FurStyle> = {
  fur_orange: { body: '#f6a85f', outline: '#c97a38', innerEar: '#f9c9b4', eye: '#2d2433' },
  fur_gray: { body: '#b3b5c0', outline: '#80838f', innerEar: '#efc7d3', eye: '#2d2433' },
  fur_white: { body: '#fbf7f1', outline: '#c9bdb0', innerEar: '#f6c6d2', eye: '#2d2433' },
  fur_black: { body: '#45414d', outline: '#2a2730', innerEar: '#9d7f93', eye: '#f2cf4a' },
  fur_cream: { body: '#f4e2c4', outline: '#c8ad84', innerEar: '#f6c6c0', eye: '#2d2433' },
  fur_pink: { body: '#f8bcd2', outline: '#d0819f', innerEar: '#fde2ec', eye: '#2d2433' },
  fur_lavender: { body: '#cdbaf1', outline: '#9580c4', innerEar: '#f2e3ff', eye: '#2d2433' },
  fur_mint: { body: '#aee6d2', outline: '#6db59b', innerEar: '#e3f8ef', eye: '#2d2433' },
}

export interface BackgroundStyle {
  from: string
  to: string
  stars?: boolean
}

export const BACKGROUND_STYLES: Record<string, BackgroundStyle> = {
  bg_peach: { from: '#ffe8d9', to: '#ffd3e2' },
  bg_sky: { from: '#dff1ff', to: '#c4dcff' },
  bg_mint: { from: '#e2fbef', to: '#c3efdc' },
  bg_sunset: { from: '#ffc78f', to: '#e88bc4' },
  bg_night: { from: '#2c2f5e', to: '#5b3f87', stars: true },
}

const EYES = ['eyes_round', 'eyes_happy', 'eyes_sleepy', 'eyes_sparkle', 'eyes_heart']
const HATS = ['hat_bow', 'hat_flower', 'hat_beanie', 'hat_party', 'hat_wizard', 'hat_crown']
const GLASSES = ['glasses_round', 'glasses_sun', 'glasses_heart']
const NECK = ['neck_collar', 'neck_bowtie', 'neck_scarf']

/** Every item key this client can draw, by slot. */
export const DRAWABLE_ITEMS: Record<CharacterSlot, readonly string[]> = {
  fur: Object.keys(FUR_STYLES),
  eyes: EYES,
  hat: HATS,
  glasses: GLASSES,
  neck: NECK,
  background: Object.keys(BACKGROUND_STYLES),
}

/** Display names for market cards. */
export const ITEM_NAMES: Record<string, { en: string; tr: string }> = {
  fur_orange: { en: 'Ginger fur', tr: 'Turuncu kürk' },
  fur_gray: { en: 'Gray fur', tr: 'Gri kürk' },
  fur_white: { en: 'Snow fur', tr: 'Kar beyazı kürk' },
  fur_black: { en: 'Midnight fur', tr: 'Gece siyahı kürk' },
  fur_cream: { en: 'Cream fur', tr: 'Krem kürk' },
  fur_pink: { en: 'Bubblegum fur', tr: 'Sakız pembesi kürk' },
  fur_lavender: { en: 'Lavender fur', tr: 'Lavanta kürk' },
  fur_mint: { en: 'Mint fur', tr: 'Nane yeşili kürk' },
  eyes_round: { en: 'Round eyes', tr: 'Yuvarlak gözler' },
  eyes_happy: { en: 'Happy eyes', tr: 'Mutlu gözler' },
  eyes_sleepy: { en: 'Sleepy eyes', tr: 'Uykulu gözler' },
  eyes_sparkle: { en: 'Sparkly eyes', tr: 'Işıltılı gözler' },
  eyes_heart: { en: 'Heart eyes', tr: 'Kalp gözler' },
  hat_bow: { en: 'Pink bow', tr: 'Pembe fiyonk' },
  hat_flower: { en: 'Flower clip', tr: 'Çiçek toka' },
  hat_beanie: { en: 'Cozy beanie', tr: 'Bere' },
  hat_party: { en: 'Party hat', tr: 'Parti şapkası' },
  hat_wizard: { en: 'Wizard hat', tr: 'Büyücü şapkası' },
  hat_crown: { en: 'Golden crown', tr: 'Altın taç' },
  glasses_round: { en: 'Round glasses', tr: 'Yuvarlak gözlük' },
  glasses_sun: { en: 'Sunglasses', tr: 'Güneş gözlüğü' },
  glasses_heart: { en: 'Heart glasses', tr: 'Kalp gözlük' },
  neck_collar: { en: 'Bell collar', tr: 'Çıngıraklı tasma' },
  neck_bowtie: { en: 'Bow tie', tr: 'Papyon' },
  neck_scarf: { en: 'Cozy scarf', tr: 'Atkı' },
  bg_peach: { en: 'Peach', tr: 'Şeftali' },
  bg_sky: { en: 'Sky', tr: 'Gökyüzü' },
  bg_mint: { en: 'Mint', tr: 'Nane' },
  bg_sunset: { en: 'Sunset', tr: 'Gün batımı' },
  bg_night: { en: 'Starry night', tr: 'Yıldızlı gece' },
}

export function itemName(key: string, language: 'en' | 'tr'): string {
  return ITEM_NAMES[key]?.[language] ?? key
}

export function isCharacterSlot(value: string): value is CharacterSlot {
  return (CHARACTER_SLOTS as readonly string[]).includes(value)
}

export function isDrawable(slot: CharacterSlot, key: string | null): key is string {
  return key !== null && DRAWABLE_ITEMS[slot].includes(key)
}

/**
 * Turns whatever is stored in `profiles.avatar_config` into a drawable
 * config. Unknown or legacy values (e.g. the old pet/tint config) fall back
 * to defaults.
 */
export function resolveCharacterConfig(raw: unknown): CharacterConfig {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const config = { ...DEFAULT_CHARACTER }
  for (const slot of CHARACTER_SLOTS) {
    const value = typeof source[slot] === 'string' ? (source[slot] as string) : null
    if (isDrawable(slot, value)) config[slot] = value
  }
  return config
}

export function sameCharacter(a: CharacterConfig, b: CharacterConfig): boolean {
  return CHARACTER_SLOTS.every((slot) => a[slot] === b[slot])
}
