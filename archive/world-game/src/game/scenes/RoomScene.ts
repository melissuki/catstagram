import Phaser from 'phaser'
import { PET_ANIMATIONS, frameKey, furnitureTextureKey, type PetKey } from '@/game/petCatalog'
import {
  CHAR_TINT,
  dirFromDelta,
  sheetKey,
  type CharDir,
} from '@/game/characterCatalog'
import {
  ensureLoopAnims,
  playEmote,
  playLoopAnim,
  showEmoteMenu,
} from '@/game/charAnims'
import type { PetTint } from '@/types/avatar'

export interface RoomFurniturePlacement {
  /** shop_items.key — stable id used for saving + ownership checks. */
  itemKey: string
  /** shop_items.sprite_key — texture lookup, matches public/game/furniture/<spriteKey>.png. */
  spriteKey: string
  x: number
  y: number
}

export interface RoomSceneData {
  petKey?: PetKey
  tint?: PetTint
  furniture?: RoomFurniturePlacement[]
}

interface FloorBounds {
  cx: number
  cy: number
  halfWidth: number
  halfHeight: number
}

interface PlacedFurniture {
  sprite: Phaser.GameObjects.Image
  spriteKey: string
}

const INTERACT_RANGE = 70

// Windows/frames need a wall to hang on (not part of this asset pack yet),
// so the default demo only places floor-standing furniture for now. Mirrors
// the starter set granted by ensure_player_room() in add_starter_furniture.sql.
const DEFAULT_FURNITURE: RoomFurniturePlacement[] = [
  { itemKey: 'furniture_cat_tree_peach', spriteKey: 'cat_tree_peach', x: 150, y: 265 },
  { itemKey: 'furniture_plant_big', spriteKey: 'plant_big', x: 110, y: 220 },
  { itemKey: 'furniture_bed_blue', spriteKey: 'bed_blue', x: 330, y: 270 },
  { itemKey: 'furniture_bowl_white_food', spriteKey: 'bowl_white_food', x: 260, y: 315 },
  { itemKey: 'furniture_fountain', spriteKey: 'fountain', x: 200, y: 320 },
]

/**
 * Personal room: Eris character walks around; the chosen cat stays as a pet
 * you can play with / feed. Furniture edit mode still rearranges the room.
 */
export class RoomScene extends Phaser.Scene {
  private petKey: PetKey = 'mochi'
  private tint: PetTint = 'none'
  private pet?: Phaser.GameObjects.Sprite
  private player?: Phaser.GameObjects.Sprite
  private facing: CharDir = 's'
  private busy = false
  private editMode = false
  private floorBounds!: FloorBounds
  private furniture = new Map<string, PlacedFurniture>()
  private foodBowl?: Phaser.GameObjects.Image
  private emoteMenu?: Phaser.GameObjects.Container

  constructor() {
    super('room')
  }

  init(data: RoomSceneData) {
    this.petKey = data.petKey ?? 'mochi'
    this.tint = data.tint ?? 'none'
    this.busy = false
    this.editMode = false
    this.furniture.clear()
    this.foodBowl = undefined
    this.emoteMenu?.destroy(true)
    this.emoteMenu = undefined
  }

  create(data: RoomSceneData) {
    const { width, height } = this.scale
    this.floorBounds = this.computeFloorBounds(width, height)
    this.drawFloor()
    ensureLoopAnims(this)
    this.createPetAnimations()

    const furniture = (data.furniture?.length ?? 0) > 0 ? data.furniture : DEFAULT_FURNITURE
    for (const item of furniture ?? []) {
      this.placeFurniture(item.itemKey, item.spriteKey, item.x, item.y)
    }

    this.createWorldDoor()
    this.spawnPet()
    this.spawnPlayer()

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.editMode || this.busy) return
      this.movePlayerTo(pointer.worldX, pointer.worldY)
    })

    this.game.events.emit('room-ready', this)
  }

  /** Walk to the pet and play with it. */
  playWithPet() {
    if (!this.pet || !this.player || this.busy || this.editMode) return
    const { x, y } = this.approachPoint(this.pet.x, this.pet.y)
    this.movePlayerTo(x, y, () => this.runPlayAnim())
  }

  /** Walk to the food bowl (or pet) and feed. */
  feedPet() {
    if (!this.pet || !this.player || this.busy || this.editMode) return
    const target = this.foodBowl ?? this.pet
    const { x, y } = this.approachPoint(target.x, target.y)
    this.movePlayerTo(x, y, () => this.runFeedAnim())
  }

  /** Sprout Lands door on the back of the room — click to enter the world. */
  private createWorldDoor() {
    const { cx, cy, halfHeight } = this.floorBounds
    const doorX = cx
    const doorY = cy - halfHeight + 28

    const panel = this.add.rectangle(doorX, doorY - 10, 56, 70, 0xe8c9a8, 0.95)
    panel.setStrokeStyle(2, 0xc4a484)
    panel.setDepth(doorY - 2)

    const door = this.add.sprite(doorX, doorY, 'room_door', 0)
    door.setScale(2.6)
    door.setOrigin(0.5, 1)
    door.setDepth(doorY)
    door.setInteractive({ useHandCursor: true })

    const label = this.add.text(doorX, doorY + 6, 'World', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#6b3e2e',
      backgroundColor: '#fff6e8ee',
      padding: { x: 6, y: 2 },
    })
    label.setOrigin(0.5, 0)
    label.setDepth(doorY + 1)

    const openWorld = (
      _pointer: Phaser.Input.Pointer,
      _lx: number,
      _ly: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation()
      this.tweens.add({
        targets: door,
        scaleX: 2.85,
        scaleY: 2.85,
        yoyo: true,
        duration: 120,
        onComplete: () => this.game.events.emit('exit-to-world'),
      })
    }

    door.on('pointerover', () => door.setTint(0xffe0b2))
    door.on('pointerout', () => door.clearTint())
    door.on('pointerdown', openWorld)
    panel.setInteractive({ useHandCursor: true })
    panel.on('pointerdown', openWorld)
  }

  private spawnPet() {
    const { cx, cy } = this.floorBounds
    const petY = cy + 20
    const petX = cx + 40
    this.pet = this.add.sprite(petX, petY, frameKey(this.petKey, 'idle', 0))
    this.pet.setOrigin(0.5, 0.9)
    this.pet.setScale(2.4)
    this.pet.setDepth(petY)
    this.pet.play(`${this.petKey}_idle`)
    this.pet.setInteractive({ useHandCursor: true })
    this.pet.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation()
        if (this.editMode) return
        this.playWithPet()
      },
    )
  }

  private spawnPlayer() {
    const { cx, cy } = this.floorBounds
    const x = cx - 50
    const y = cy + 50
    this.player = this.add.sprite(x, y, sheetKey('idle'), 0)
    this.player.setScale(2.4)
    this.player.setOrigin(0.5, 0.95)
    this.player.setDepth(y)
    this.player.setTint(CHAR_TINT[this.tint] ?? 0xffffff)
    this.playCharAnim('idle', 's')
    this.player.setInteractive({ useHandCursor: true })
    this.player.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation()
        if (this.editMode || this.busy) return
        this.openEmoteMenu()
      },
    )
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

  private playCharAnim(anim: 'idle' | 'walk' | 'run', dir: CharDir) {
    if (!this.player) return
    this.facing = dir
    playLoopAnim(this, this.player, anim, dir)
  }

  /** Toggles furniture dragging on/off; also pauses click-to-move while editing. */
  setEditMode(on: boolean) {
    this.editMode = on
    for (const { sprite, spriteKey } of this.furniture.values()) {
      if (on) {
        sprite.setInteractive({ useHandCursor: true, draggable: true })
      } else if (spriteKey.includes('bowl') && spriteKey.includes('food')) {
        sprite.setInteractive({ useHandCursor: true })
      } else {
        sprite.disableInteractive()
      }
    }
  }

  /** Adds (or repositions, if already placed) an owned furniture piece. */
  placeFurniture(itemKey: string, spriteKey: string, x?: number, y?: number) {
    const existing = this.furniture.get(itemKey)
    if (existing) {
      const { x: cx, y: cy } = this.clampToFloor(x ?? existing.sprite.x, y ?? existing.sprite.y)
      existing.sprite.setPosition(cx, cy)
      existing.sprite.setDepth(cy)
      return
    }

    const { x: px, y: py } = this.clampToFloor(x ?? this.floorBounds.cx, y ?? this.floorBounds.cy)
    const sprite = this.add.image(px, py, furnitureTextureKey(spriteKey))
    sprite.setOrigin(0.5, 0.92)
    sprite.setDepth(py)
    if (this.editMode) sprite.setInteractive({ useHandCursor: true, draggable: true })

    sprite.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      const clamped = this.clampToFloor(dragX, dragY)
      sprite.setPosition(clamped.x, clamped.y)
      sprite.setDepth(clamped.y)
    })

    this.furniture.set(itemKey, { sprite, spriteKey })

    if (spriteKey.includes('bowl') && spriteKey.includes('food')) {
      this.foodBowl = sprite
      sprite.setInteractive({ useHandCursor: true })
      sprite.on(
        'pointerdown',
        (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
          e.stopPropagation()
          if (this.editMode) return
          this.feedPet()
        },
      )
    }
  }

  /** Removes a placed piece (e.g. sent back to the "not placed" palette in React). */
  removeFurniture(itemKey: string) {
    const existing = this.furniture.get(itemKey)
    if (!existing) return
    if (this.foodBowl === existing.sprite) this.foodBowl = undefined
    existing.sprite.destroy()
    this.furniture.delete(itemKey)
  }

  /** Current placement of every furniture piece, ready for `saveRoomLayout`. */
  getLayout(): RoomFurniturePlacement[] {
    return Array.from(this.furniture.entries()).map(([itemKey, { sprite, spriteKey }]) => ({
      itemKey,
      spriteKey,
      x: Math.round(sprite.x),
      y: Math.round(sprite.y),
    }))
  }

  private computeFloorBounds(width: number, height: number): FloorBounds {
    return {
      cx: width / 2,
      cy: height / 2 + 70,
      halfWidth: (width * 0.85) / 2,
      halfHeight: (height * 0.55) / 2,
    }
  }

  private drawFloor() {
    const { cx, cy, halfWidth, halfHeight } = this.floorBounds
    const g = this.add.graphics()
    g.fillStyle(0xfdf1e6, 1)
    g.beginPath()
    g.moveTo(cx, cy - halfHeight)
    g.lineTo(cx + halfWidth, cy)
    g.lineTo(cx, cy + halfHeight)
    g.lineTo(cx - halfWidth, cy)
    g.closePath()
    g.fillPath()
    g.setDepth(-1)
  }

  private clampToFloor(x: number, y: number): { x: number; y: number } {
    const { cx, cy, halfWidth, halfHeight } = this.floorBounds
    const dx = (x - cx) / halfWidth
    const dy = (y - cy) / halfHeight
    const d = Math.abs(dx) + Math.abs(dy)
    if (d <= 1) return { x, y }
    return { x: cx + (dx / d) * halfWidth, y: cy + (dy / d) * halfHeight }
  }

  private approachPoint(tx: number, ty: number) {
    if (!this.player) return { x: tx, y: ty }
    const dx = this.player.x - tx
    const dy = this.player.y - ty
    const dist = Math.hypot(dx, dy) || 1
    const stand = Math.min(36, dist * 0.5)
    return this.clampToFloor(tx + (dx / dist) * stand, ty + (dy / dist) * stand)
  }

  private movePlayerTo(targetX: number, targetY: number, onArrive?: () => void) {
    if (!this.player || this.busy) return
    const { x, y } = this.clampToFloor(targetX, targetY)
    this.tweens.killTweensOf(this.player)
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y)
    if (distance < 4) {
      onArrive?.()
      return
    }
    const duration = Phaser.Math.Clamp(distance * 3.2, 180, 1100)
    const dir = dirFromDelta(x - this.player.x, y - this.player.y)
    this.playCharAnim(distance > 180 ? 'run' : 'walk', dir)

    this.tweens.add({
      targets: this.player,
      x,
      y,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.player?.setDepth(this.player.y),
      onComplete: () => {
        this.playCharAnim('idle', this.facing)
        onArrive?.()
      },
    })
  }

  private createPetAnimations() {
    const anims = PET_ANIMATIONS[this.petKey]
    for (const [anim, count] of Object.entries(anims)) {
      const key = `${this.petKey}_${anim}`
      if (this.anims.exists(key)) continue
      this.anims.create({
        key,
        frames: Array.from({ length: count }, (_, i) => ({
          key: frameKey(this.petKey, anim, i),
        })),
        frameRate: anim === 'idle' ? 4 : 6,
        repeat: anim === 'idle' || anim === 'sleep' ? -1 : 0,
      })
    }
  }

  private withinRange(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) <= INTERACT_RANGE
  }

  private runPlayAnim() {
    if (!this.pet || !this.player || this.busy) return
    if (!this.withinRange(this.player, this.pet)) {
      this.game.events.emit('room-toast', { kind: 'too-far', action: 'play' })
      return
    }

    this.busy = true
    this.facing = dirFromDelta(this.pet.x - this.player.x, this.pet.y - this.player.y)
    playEmote(this, this.player, 'wave', this.facing)

    const anims = PET_ANIMATIONS[this.petKey]
    const secondary = Object.keys(anims).find((name) => name !== 'idle' && name !== 'sleep')
    if (secondary) {
      this.pet.play(`${this.petKey}_${secondary}`)
      this.pet.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.pet?.play(`${this.petKey}_idle`)
        this.playCharAnim('idle', this.facing)
        this.busy = false
        this.game.events.emit('room-toast', { kind: 'played' })
      })
    } else {
      this.tweens.add({
        targets: this.pet,
        scale: this.pet.scale * 1.12,
        yoyo: true,
        duration: 160,
        onComplete: () => {
          this.playCharAnim('idle', this.facing)
          this.busy = false
          this.game.events.emit('room-toast', { kind: 'played' })
        },
      })
    }
  }

  private runFeedAnim() {
    if (!this.pet || !this.player || this.busy) return
    const nearBowl = this.foodBowl ? this.withinRange(this.player, this.foodBowl) : false
    const nearPet = this.withinRange(this.player, this.pet)
    if (!nearBowl && !nearPet) {
      this.game.events.emit('room-toast', { kind: 'too-far', action: 'feed' })
      return
    }

    this.busy = true
    this.playCharAnim('idle', this.facing)

    // Brief hop toward bowl / pet
    this.tweens.add({
      targets: this.pet,
      y: this.pet.y - 8,
      yoyo: true,
      duration: 180,
      ease: 'Sine.easeOut',
    })

    if (this.anims.exists(`${this.petKey}_sleep`)) {
      // Happy nibble: short secondary then idle
      const anims = PET_ANIMATIONS[this.petKey]
      const secondary = Object.keys(anims).find((name) => name !== 'idle' && name !== 'sleep')
      if (secondary) this.pet.play(`${this.petKey}_${secondary}`)
    }

    this.time.delayedCall(700, () => {
      this.pet?.play(`${this.petKey}_idle`)
      this.busy = false
      this.game.events.emit('room-toast', { kind: 'fed' })
    })
  }
}
