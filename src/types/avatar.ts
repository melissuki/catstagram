/**
 * The game avatar is now a customizable cat character. Kept under this module
 * name because `profiles.avatar_config` stores it.
 */
export type { CharacterConfig as AvatarConfig, CharacterSlot } from '@/character/catalog'
export {
  DEFAULT_CHARACTER as DEFAULT_AVATAR_CONFIG,
  resolveCharacterConfig as resolveAvatarConfig,
} from '@/character/catalog'
