import type { PetTint } from '@/types/avatar'

/**
 * Eris Esra Character Template 4.1 — 16×32 sprites on a 32×32 canvas.
 * Rows: S, SE, E, NE, N (mirror for W / SW / NW).
 * Credit: Eris Esra — https://www.erisesra.com/socials
 */

export type CharDir = 's' | 'se' | 'e' | 'ne' | 'n' | 'nw' | 'w' | 'sw'

export type CharAnim = 'idle' | 'walk' | 'run' | 'jump' | 'interact' | 'attack'

/** One-shot actions the player can trigger by tapping their character */
export type CharEmote = 'wave' | 'jump' | 'cheer' | 'spin'

export const CHAR_EMOTES: Array<{ id: CharEmote; label: string; anim: CharAnim }> = [
  { id: 'wave', label: 'Wave', anim: 'interact' },
  { id: 'jump', label: 'Jump', anim: 'jump' },
  { id: 'cheer', label: 'Cheer', anim: 'interact' },
  { id: 'spin', label: 'Spin', anim: 'attack' },
]

export const CHAR_FRAME = 32

/** Columns per animation sheet */
export const CHAR_ANIM_COLS: Record<CharAnim, number> = {
  idle: 4,
  walk: 4,
  run: 6,
  jump: 5,
  interact: 4,
  attack: 7,
}

export const CHAR_SHEET_PATH: Record<CharAnim, string> = {
  idle: '/game/characters/eris/idle.png',
  walk: '/game/characters/eris/walk.png',
  run: '/game/characters/eris/run.png',
  jump: '/game/characters/eris/jump.png',
  interact: '/game/characters/eris/interact.png',
  attack: '/game/characters/eris/attack.png',
}

export const CHAR_DIRS: CharDir[] = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw']

const DIR_ROW: Record<CharDir, { row: number; flip: boolean }> = {
  s: { row: 0, flip: false },
  se: { row: 1, flip: false },
  e: { row: 2, flip: false },
  ne: { row: 3, flip: false },
  n: { row: 4, flip: false },
  nw: { row: 3, flip: true },
  w: { row: 2, flip: true },
  sw: { row: 1, flip: true },
}

export function dirFromDelta(dx: number, dy: number): CharDir {
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return 's'
  const angle = Math.atan2(dy, dx) // -PI..PI, x-right y-down
  const deg = (angle * 180) / Math.PI
  // 8-way buckets
  if (deg >= -22.5 && deg < 22.5) return 'e'
  if (deg >= 22.5 && deg < 67.5) return 'se'
  if (deg >= 67.5 && deg < 112.5) return 's'
  if (deg >= 112.5 && deg < 157.5) return 'sw'
  if (deg >= 157.5 || deg < -157.5) return 'w'
  if (deg >= -157.5 && deg < -112.5) return 'nw'
  if (deg >= -112.5 && deg < -67.5) return 'n'
  return 'ne'
}

export function dirLayout(dir: CharDir) {
  return DIR_ROW[dir]
}

export function sheetKey(anim: CharAnim): string {
  return `eris_${anim}`
}

export function animKey(anim: CharAnim, dir: CharDir): string {
  const baseDir = DIR_ROW[dir].flip
    ? ({ nw: 'ne', w: 'e', sw: 'se' } as const)[dir as 'nw' | 'w' | 'sw']
    : dir
  return `eris_${anim}_${baseDir}`
}

/** Soft fur-like tints for the white Eris template body */
export const CHAR_TINT: Record<PetTint, number> = {
  none: 0xffffff,
  sandy: 0xf0c98a,
  silver: 0xd0d4dc,
  blush: 0xf2b8c6,
  mint: 0xb8e0c8,
  lavender: 0xd4c4f0,
}

/** Pixelart Study expression sheet — 3×6 faces, 16×16 each */
export const EXPR_SHEET = '/game/characters/expressions/faces.png'
export const EXPR_FRAME = 16
export const EXPR_COLS = 3

export const EXPR_NAMES = [
  'hollow',
  'neutral',
  'serious',
  'pleased',
  'happy',
  'elated',
  'gloomy',
  'sad',
  'despair',
  'anxious',
  'fear',
  'terror',
  'annoyed',
  'angry',
  'rage',
  'confused',
  'surprised',
  'shocked',
] as const

export type ExprName = (typeof EXPR_NAMES)[number]

export function exprFrameIndex(name: ExprName): number {
  return EXPR_NAMES.indexOf(name)
}

export function exprForChat(): ExprName {
  const chatty: ExprName[] = ['happy', 'elated', 'pleased', 'surprised', 'neutral']
  return chatty[Math.floor(Math.random() * chatty.length)]!
}
