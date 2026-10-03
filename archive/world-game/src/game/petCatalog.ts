import type { PetKey, PetTint } from '@/types/avatar'

export type { PetKey }

const pad = (n: number) => String(n).padStart(2, '0')

/** Frame counts per animation, sourced from CatMegaFree (Mochi/Pochi). Neither
 * pet has a walk cycle — both are stationary "desktop pet" style animations,
 * which is why the personal room doesn't need player movement. */
export const PET_ANIMATIONS: Record<PetKey, Record<string, number>> = {
  mochi: { idle: 10, box: 4 },
  pochi: { idle: 4, react: 2, sleep: 4 },
}

/** Texture key never encodes tint — only one tint is ever loaded per game session. */
export function frameKey(pet: PetKey, anim: string, index: number): string {
  return `${pet}_${anim}_${pad(index)}`
}

/**
 * Frames are pre-recoloured per tint (only fur pixels shifted — eyes/nose/
 * outline untouched) by scripts/recolor-pets, not a runtime Phaser tint,
 * since a plain multiply tint washes out the whole sprite including the face.
 */
export function framePath(
  pet: PetKey,
  anim: string,
  index: number,
  tint: PetTint = 'none',
): string {
  const suffix = tint === 'none' ? '' : `_${tint}`
  return `/game/pets/${pet}/${anim}_${pad(index)}${suffix}.png`
}

/** Matches supabase/migrations/add_shop_and_rooms.sql shop_items.sprite_key values. */
export const FURNITURE_SPRITE_KEYS = [
  'cat_tree_peach',
  'cat_tree_olive',
  'cat_tree_blue_tall',
  'bed_blue',
  'bed_gray',
  'bed_pink',
  'bed_olive',
  'bed_purple',
  'bed_white',
  'window_cream',
  'window_dark',
  'window_graytint',
  'window_brown',
  'frame_small',
  'frame_tan',
  'frame_dark',
  'plant_small',
  'plant_big',
  'shelf',
  'fountain',
  'bowl_blue_food',
  'bowl_lightblue_water',
  'bowl_white_food',
  'toy_dumbbell',
  'ball_green',
  'ball_purple',
  'ball_teal',
  'ball_navy',
] as const

export function furnitureTextureKey(spriteKey: string): string {
  return `furniture_${spriteKey}`
}

export function furnitureTexturePath(spriteKey: string): string {
  return `/game/furniture/${spriteKey}.png`
}

export const PET_LIST: PetKey[] = ['mochi', 'pochi']

export function petPreviewPath(pet: PetKey, tint: PetTint = 'none'): string {
  return framePath(pet, 'idle', 0, tint)
}
