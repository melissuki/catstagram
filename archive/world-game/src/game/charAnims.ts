import Phaser from 'phaser'
import {
  CHAR_ANIM_COLS,
  CHAR_EMOTES,
  animKey,
  dirLayout,
  sheetKey,
  type CharAnim,
  type CharDir,
  type CharEmote,
} from '@/game/characterCatalog'

const LOOP_ANIMS: CharAnim[] = ['idle', 'walk', 'run']
const BASE_DIRS: CharDir[] = ['s', 'se', 'e', 'ne', 'n']

/** Register directional loop animations used by world/room/interior. */
export function ensureLoopAnims(scene: Phaser.Scene) {
  for (const anim of LOOP_ANIMS) {
    const cols = CHAR_ANIM_COLS[anim]
    const texture = sheetKey(anim)
    if (!scene.textures.exists(texture)) continue
    for (const dir of BASE_DIRS) {
      const name = animKey(anim, dir)
      if (scene.anims.exists(name)) continue
      const { row } = dirLayout(dir)
      const start = row * cols
      scene.anims.create({
        key: name,
        frames: scene.anims.generateFrameNumbers(texture, {
          start,
          end: start + cols - 1,
        }),
        frameRate: anim === 'idle' ? 4 : anim === 'run' ? 10 : 8,
        repeat: -1,
      })
    }
  }
}

export function playLoopAnim(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  anim: CharAnim,
  dir: CharDir,
) {
  const layout = dirLayout(dir)
  sprite.setFlipX(layout.flip)
  const key = animKey(anim, dir)
  if (scene.anims.exists(key)) sprite.play(key, true)
}

/** Play a one-shot emote, then return to idle facing `dir`. */
export function playEmote(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  emote: CharEmote,
  dir: CharDir,
  onDone?: () => void,
) {
  const def = CHAR_EMOTES.find((e) => e.id === emote)
  if (!def) {
    onDone?.()
    return
  }
  const anim = def.anim
  const texture = sheetKey(anim)
  if (!scene.textures.exists(texture)) {
    onDone?.()
    return
  }

  const cols = CHAR_ANIM_COLS[anim]
  const layout = dirLayout(dir)
  sprite.setFlipX(layout.flip)
  // For mirrored dirs, use the unflipped base row
  const baseDir = layout.flip
    ? ({ nw: 'ne', w: 'e', sw: 'se' } as const)[dir as 'nw' | 'w' | 'sw']
    : dir
  const baseRow = dirLayout(baseDir).row
  const start = baseRow * cols
  const key = `eris_emote_${emote}_${baseDir}`
  if (scene.anims.exists(key)) scene.anims.remove(key)
  scene.anims.create({
    key,
    frames: scene.anims.generateFrameNumbers(texture, {
      start,
      end: start + cols - 1,
    }),
    frameRate: emote === 'jump' ? 10 : 8,
    repeat: 0,
  })

  sprite.play(key)
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    playLoopAnim(scene, sprite, 'idle', dir)
    onDone?.()
  })
}

/** Floating emote picker above the player. */
export function showEmoteMenu(
  scene: Phaser.Scene,
  x: number,
  y: number,
  onPick: (emote: CharEmote) => void,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y - 70)
  container.setDepth(10_000)

  const bg = scene.add.rectangle(0, 0, 210, 44, 0xfff8e8, 0.95)
  bg.setStrokeStyle(2, 0xc4a484)
  container.add(bg)

  CHAR_EMOTES.forEach((emote, i) => {
    const bx = -78 + i * 52
    const btn = scene.add
      .text(bx, 0, emote.label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#3d2914',
        backgroundColor: '#ffe8c8',
        padding: { x: 6, y: 5 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    btn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation()
      onPick(emote.id)
      container.destroy(true)
    })
    container.add(btn)
  })

  // Auto-dismiss
  scene.time.delayedCall(4500, () => {
    if (container.active) container.destroy(true)
  })

  return container
}
