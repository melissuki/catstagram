import Phaser from 'phaser'
import { BootScene } from '@/game/scenes/BootScene'
import { InteriorScene } from '@/game/scenes/InteriorScene'
import { RoomScene } from '@/game/scenes/RoomScene'
import { WorldScene } from '@/game/scenes/WorldScene'

type GameMode = 'room' | 'world'

/**
 * Room mode boots Boot→Room. World mode loads World + Interior
 * (enterable cafe/shop/park) without auto-starting the room.
 */
export function createGameConfig(
  parent: HTMLElement,
  mode: GameMode = 'room',
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: 800,
    height: 600,
    transparent: true,
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene:
      mode === 'world'
        ? [WorldScene, InteriorScene]
        : [BootScene, RoomScene, WorldScene, InteriorScene],
  }
}
