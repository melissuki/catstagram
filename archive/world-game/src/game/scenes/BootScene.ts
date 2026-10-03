import Phaser from 'phaser'
import {
  FURNITURE_SPRITE_KEYS,
  PET_ANIMATIONS,
  frameKey,
  framePath,
  furnitureTexturePath,
  furnitureTextureKey,
  type PetKey,
} from '@/game/petCatalog'
import {
  CHAR_FRAME,
  CHAR_SHEET_PATH,
  sheetKey,
  type CharAnim,
} from '@/game/characterCatalog'
import type { PetTint } from '@/types/avatar'
import type { RoomFurniturePlacement } from '@/game/scenes/RoomScene'

interface BootSceneData {
  petKey?: PetKey
  tint?: PetTint
  furniture?: RoomFurniturePlacement[]
}

export class BootScene extends Phaser.Scene {
  private petKey: PetKey = 'mochi'
  private tint: PetTint = 'none'
  private furniture?: RoomFurniturePlacement[]

  constructor() {
    super('boot')
  }

  init(data: BootSceneData) {
    this.petKey = data.petKey ?? 'mochi'
    this.tint = data.tint ?? 'none'
    this.furniture = data.furniture
  }

  preload() {
    ;(Object.keys(PET_ANIMATIONS) as PetKey[]).forEach((pet) => {
      Object.entries(PET_ANIMATIONS[pet]).forEach(([anim, count]) => {
        for (let i = 0; i < count; i++) {
          this.load.image(frameKey(pet, anim, i), framePath(pet, anim, i, this.tint))
        }
      })
    })

    FURNITURE_SPRITE_KEYS.forEach((key) => {
      this.load.image(furnitureTextureKey(key), furnitureTexturePath(key))
    })

    this.load.spritesheet('room_door', '/game/world/tiles/Doors.png', {
      frameWidth: 16,
      frameHeight: 32,
    })

    // Eris character for walking around the room with the pet
    for (const anim of Object.keys(CHAR_SHEET_PATH) as CharAnim[]) {
      this.load.spritesheet(sheetKey(anim), CHAR_SHEET_PATH[anim], {
        frameWidth: CHAR_FRAME,
        frameHeight: CHAR_FRAME,
      })
    }
  }

  create() {
    this.scene.start('room', {
      petKey: this.petKey,
      tint: this.tint,
      furniture: this.furniture,
    })
  }
}
