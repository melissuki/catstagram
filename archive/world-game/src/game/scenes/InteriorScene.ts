import Phaser from 'phaser'
import {
  CHAR_FRAME,
  CHAR_SHEET_PATH,
  CHAR_TINT,
  sheetKey,
  type CharAnim,
  type CharDir,
} from '@/game/characterCatalog'
import { ensureLoopAnims, playLoopAnim, playEmote, showEmoteMenu } from '@/game/charAnims'
import { dirFromDelta } from '@/game/characterCatalog'
import type { PetTint } from '@/types/avatar'

export type InteriorKind = 'shop' | 'cafe' | 'park'

export interface InteriorSceneData {
  kind: InteriorKind
  label: string
  tint?: PetTint
  returnX?: number
  returnY?: number
}

const BLURB: Record<InteriorKind, string> = {
  cafe: 'Fish Cafe — grab a seat. Click a table to order!',
  shop: 'Cat Shop — browse the shelves. Click a shelf!',
  park: 'Park pavilion — rest on the rug. Click to lounge!',
}

/**
 * Enterable POI — Interior free furniture layouts.
 */
export class InteriorScene extends Phaser.Scene {
  private kind: InteriorKind = 'cafe'
  private label = 'Inside'
  private tint: PetTint = 'none'
  private player?: Phaser.GameObjects.Sprite
  private facing: CharDir = 's'
  private busy = false
  private emoteMenu?: Phaser.GameObjects.Container
  private returnX = 400
  private returnY = 300

  constructor() {
    super('interior')
  }

  init(data: InteriorSceneData) {
    this.kind = data.kind
    this.label = data.label
    this.tint = data.tint ?? 'none'
    this.returnX = data.returnX ?? 400
    this.returnY = data.returnY ?? 300
    this.busy = false
    this.emoteMenu?.destroy(true)
    this.emoteMenu = undefined
  }

  preload() {
    const I = '/game/interior'
    const keys: Array<[string, string]> = [
      ['int_floor', 'floor.png'],
      ['int_wall', 'wall.png'],
      ['int_wall_b', 'wall_b.png'],
      ['int_rug', 'rug.png'],
      ['int_table', 'table.png'],
      ['int_stool', 'stool.png'],
      ['int_chair_s', 'chair_s.png'],
      ['int_chair_n', 'chair_n.png'],
      ['int_chair_e', 'chair_e.png'],
      ['int_chair_w', 'chair_w.png'],
      ['int_shelf', 'shelf.png'],
      ['int_plant', 'plant.png'],
      ['int_candles', 'candles.png'],
      ['int_poster_a', 'poster_a.png'],
      ['int_poster_b', 'poster_b.png'],
      ['int_cabinet', 'cabinet.png'],
    ]
    for (const [key, file] of keys) {
      if (!this.textures.exists(key)) this.load.image(key, `${I}/${file}`)
    }
    if (!this.textures.exists('picnic_basket')) {
      this.load.image('picnic_basket', '/game/world/plants/picnic_basket.png')
    }
    for (const anim of Object.keys(CHAR_SHEET_PATH) as CharAnim[]) {
      if (this.textures.exists(sheetKey(anim))) continue
      this.load.spritesheet(sheetKey(anim), CHAR_SHEET_PATH[anim], {
        frameWidth: CHAR_FRAME,
        frameHeight: CHAR_FRAME,
      })
    }
  }

  create() {
    for (const key of this.textures.getTextureKeys()) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
    }

    const { width, height } = this.scale
    const warm = this.kind === 'park' ? 0xb8d98a : 0xd4b896
    this.cameras.main.setBackgroundColor(warm)

    // Back wall
    const wallKey = this.kind === 'shop' ? 'int_wall_b' : 'int_wall'
    if (this.textures.exists(wallKey)) {
      this.add.tileSprite(width / 2, 78, width - 48, 100, wallKey).setDepth(0)
    } else {
      this.add.rectangle(width / 2, 78, width - 48, 100, 0xe8d4b8).setDepth(0)
    }

    // Floor
    if (this.textures.exists('int_floor')) {
      this.add
        .tileSprite(width / 2, height / 2 + 55, width - 64, height - 150, 'int_floor')
        .setDepth(0.5)
    } else {
      this.add
        .rectangle(width / 2, height / 2 + 55, width - 64, height - 150, 0xf0e0c8)
        .setDepth(0.5)
    }

    // Center rug
    if (this.textures.exists('int_rug')) {
      const rug = this.add.image(width / 2, height / 2 + 75, 'int_rug')
      rug.setScale(this.kind === 'park' ? 3.6 : 2.8)
      rug.setDepth(0.7)
    }

    this.add
      .text(width / 2, 26, this.label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#fff8e8',
        backgroundColor: '#5c4033dd',
        padding: { x: 12, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(30)

    this.add
      .text(width / 2, 108, BLURB[this.kind], {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#3d2914',
        backgroundColor: '#fff8e8ee',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(30)

    if (this.kind === 'cafe') this.layoutCafe(width, height)
    else if (this.kind === 'shop') this.layoutShop(width, height)
    else this.layoutPark(width, height)

    this.createExit(width, height)

    ensureLoopAnims(this)
    this.player = this.add.sprite(width / 2, height / 2 + 90, sheetKey('idle'), 0)
    this.player.setScale(2.8)
    this.player.setOrigin(0.5, 0.95)
    this.player.setTint(CHAR_TINT[this.tint] ?? 0xffffff)
    this.player.setInteractive({ useHandCursor: true })
    this.player.setDepth(height)
    playLoopAnim(this, this.player, 'idle', 's')

    this.player.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation()
        this.openEmoteMenu()
      },
    )

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.busy || !this.player) return
      this.moveTo(pointer.worldX, pointer.worldY)
    })
  }

  /** Two cafe tables with chairs, candles, plants, posters. */
  private layoutCafe(width: number, height: number) {
    const cy = height / 2 + 20

    // Left dining set
    this.put('int_table', width * 0.32, cy + 10, 2.6, true, () => this.cafeOrder())
    this.put('int_chair_s', width * 0.32 - 55, cy + 55, 2.3)
    this.put('int_chair_s', width * 0.32 + 55, cy + 55, 2.3)
    this.put('int_chair_n', width * 0.32, cy - 35, 2.3)
    this.put('int_candles', width * 0.32, cy - 2, 2.8)

    // Right dining set
    this.put('int_table', width * 0.68, cy + 10, 2.6, true, () => this.cafeOrder())
    this.put('int_chair_s', width * 0.68 - 55, cy + 55, 2.3)
    this.put('int_chair_s', width * 0.68 + 55, cy + 55, 2.3)
    this.put('int_chair_n', width * 0.68, cy - 35, 2.3)
    this.put('int_candles', width * 0.68 + 8, cy - 2, 2.8)

    // Counter stools along back
    this.put('int_stool', width * 0.42, cy - 70, 2.1)
    this.put('int_stool', width * 0.5, cy - 70, 2.1)
    this.put('int_stool', width * 0.58, cy - 70, 2.1)
    this.put('int_shelf', width / 2, 130, 3.4)

    this.put('int_plant', 70, height - 90, 3.2)
    this.put('int_plant', width - 70, height - 90, 3.2)
    this.put('int_poster_a', 90, 95, 2.4)
    this.put('int_poster_b', width - 90, 95, 2.4)
  }

  /** Shop: shelves, counter table, cabinet, posters. */
  private layoutShop(width: number, height: number) {
    const cy = height / 2 + 10

    this.put('int_shelf', width * 0.28, cy - 30, 3.6, true, () => this.shopBrowse())
    this.put('int_shelf', width * 0.72, cy - 30, 3.6, true, () => this.shopBrowse())
    this.put('int_table', width / 2, cy + 40, 2.8, true, () => this.shopBrowse())
    this.put('int_cabinet', width * 0.2, cy + 50, 2.6)
    this.put('int_cabinet', width * 0.8, cy + 50, 2.6)
    this.put('int_chair_e', width / 2 + 70, cy + 70, 2.2)
    this.put('int_chair_w', width / 2 - 70, cy + 70, 2.2)
    this.put('int_plant', 80, height - 100, 3)
    this.put('int_plant', width - 80, height - 100, 3)
    this.put('int_poster_a', width * 0.35, 95, 2.3)
    this.put('int_poster_b', width * 0.65, 95, 2.3)
    this.put('int_candles', width / 2, cy + 25, 2.6)
  }

  /** Park pavilion: big rug, plants, picnic, chairs. */
  private layoutPark(width: number, height: number) {
    const cy = height / 2 + 30
    this.put('int_rug', width / 2, cy, 3.4, true, () => this.parkRest())
    this.put('int_plant', 90, cy + 20, 3.4)
    this.put('int_plant', width - 90, cy + 20, 3.4)
    this.put('int_plant', width / 2 - 140, cy - 40, 3)
    this.put('int_plant', width / 2 + 140, cy - 40, 3)
    this.put('int_chair_s', width / 2 - 80, cy + 70, 2.4)
    this.put('int_chair_s', width / 2 + 80, cy + 70, 2.4)
    this.put('int_stool', width / 2, cy + 55, 2.2)
    if (this.textures.exists('picnic_basket')) {
      const basket = this.add.image(width / 2 + 40, cy - 10, 'picnic_basket')
      basket.setScale(2.8)
      basket.setOrigin(0.5, 1)
      basket.setDepth(cy)
    }
  }

  private cafeOrder() {
    this.game.events.emit('interior-action', {
      kind: this.kind,
      action: 'order',
      message: 'You ordered a tuna latte. Meow!',
    })
    if (this.player) playEmote(this, this.player, 'cheer', this.facing)
  }

  private shopBrowse() {
    this.game.events.emit('interior-action', {
      kind: this.kind,
      action: 'browse',
      message: 'Sparkly collar caught your eye… (shop soon)',
    })
    if (this.player) playEmote(this, this.player, 'wave', this.facing)
  }

  private parkRest() {
    this.game.events.emit('interior-action', {
      kind: this.kind,
      action: 'rest',
      message: 'You lounged in the sun. Soft.',
    })
    if (this.player) playEmote(this, this.player, 'jump', this.facing)
  }

  private put(
    key: string,
    x: number,
    y: number,
    scale: number,
    interactive = false,
    onClick?: () => void,
  ) {
    if (!this.textures.exists(key)) return
    const img = this.add.image(x, y, key)
    img.setScale(scale)
    img.setOrigin(0.5, 1)
    img.setDepth(y)
    if (interactive && onClick) {
      img.setInteractive({ useHandCursor: true })
      img.on(
        'pointerdown',
        (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
          e.stopPropagation()
          onClick()
        },
      )
    }
  }

  private createExit(width: number, height: number) {
    const door = this.add.rectangle(width / 2, height - 36, 100, 42, 0x5c4033)
    door.setStrokeStyle(2, 0xffe0b2)
    door.setInteractive({ useHandCursor: true })
    door.setDepth(200)
    const label = this.add
      .text(width / 2, height - 36, 'Exit →', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fff8e8',
      })
      .setOrigin(0.5)
      .setDepth(201)

    const leave = (
      _p: Phaser.Input.Pointer,
      _x: number,
      _y: number,
      e: Phaser.Types.Input.EventData,
    ) => {
      e.stopPropagation()
      this.game.events.emit('exit-interior', {
        returnX: this.returnX,
        returnY: this.returnY,
      })
      this.scene.stop('interior')
      if (this.scene.isPaused('world')) this.scene.resume('world')
    }
    door.on('pointerdown', leave)
    label.setInteractive({ useHandCursor: true })
    label.on('pointerdown', leave)
  }

  private openEmoteMenu() {
    if (!this.player || this.busy) return
    this.emoteMenu?.destroy(true)
    this.emoteMenu = showEmoteMenu(this, this.player.x, this.player.y, (emote) => {
      if (!this.player) return
      this.busy = true
      playEmote(this, this.player, emote, this.facing, () => {
        this.busy = false
      })
    })
  }

  private moveTo(tx: number, ty: number) {
    if (!this.player || this.busy) return
    const { width, height } = this.scale
    const x = Phaser.Math.Clamp(tx, 80, width - 80)
    const y = Phaser.Math.Clamp(ty, 150, height - 70)
    this.tweens.killTweensOf(this.player)
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y)
    if (dist < 4) return
    const dir = dirFromDelta(x - this.player.x, y - this.player.y)
    this.facing = dir
    playLoopAnim(this, this.player, dist > 160 ? 'run' : 'walk', dir)
    this.tweens.add({
      targets: this.player,
      x,
      y,
      duration: Phaser.Math.Clamp(dist * 3, 160, 900),
      ease: 'Sine.easeInOut',
      onUpdate: () => this.player?.setDepth(this.player.y),
      onComplete: () => playLoopAnim(this, this.player!, 'idle', this.facing),
    })
  }
}
