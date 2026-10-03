import Phaser from 'phaser'
import type { PetKey } from '@/game/petCatalog'
import {
  CHAR_FRAME,
  CHAR_SHEET_PATH,
  CHAR_TINT,
  EXPR_FRAME,
  EXPR_SHEET,
  dirFromDelta,
  exprForChat,
  exprFrameIndex,
  sheetKey,
  type CharAnim,
  type CharDir,
} from '@/game/characterCatalog'
import {
  ensureLoopAnims,
  playEmote,
  playLoopAnim,
  showEmoteMenu,
} from '@/game/charAnims'
import type { InteriorKind } from '@/game/scenes/InteriorScene'
import type { PetTint } from '@/types/avatar'
import {
  claimWorldHome,
  fetchActivePlayers,
  fetchWorldHomes,
  leaveWorld,
  subscribeToPlayerPositions,
  subscribeToWorldHomes,
  updatePlayerPosition as pushMyPosition,
  type PlayerPosition,
  type WorldHome,
} from '@/services/world'

export interface WorldSceneData {
  petKey?: PetKey
  petTint?: PetTint
  faceStyle?: number
  playerName?: string
  userId?: string
}

interface Player {
  sprite: Phaser.GameObjects.Sprite
  nameText: Phaser.GameObjects.Text
  bubble?: Phaser.GameObjects.Text
  face?: Phaser.GameObjects.Image
  playerId: string
  petKey: PetKey
  tint: PetTint
  facing: CharDir
  isMe: boolean
}

interface ChopTree {
  sprite: Phaser.GameObjects.Image
  chopped: boolean
}

const POSITION_THROTTLE_MS = 500
const HEARTBEAT_MS = 12_000
const INACTIVE_MS = 45_000
const TILE = 16
/** Chunkier pixels — closer to the Sprout Lands itch banner */
const SCALE = 3
const MAP_W = 48
const MAP_H = 36
/** Keep in sync with claim_world_home() in add_world_homes.sql */
const HOUSE_STREET_Y = 160
/** Keep in sync with claim_world_home() base_x — used for the local fallback home */
const HOUSE_BASE_X = 140
const HOUSE_SCALE = 1.9
/** Whole-sprite trees from Sprout Lands / Plant update packs */
const TREE_KEYS = [
  't_oak',
  't_pine',
  't_birch',
  't_round',
  't_fruit',
  't_slim',
  't_pine_md',
  't_pine_sm',
] as const
const BUSH_KEYS = ['bush_a', 'bush_b'] as const
const DECO_KEYS = [
  'mush',
  'sunflower',
  'flowers',
  'flower_a',
  'rock',
  'rock_sm',
  'stump',
  'wood_0',
  'wood_1',
  'wood_2',
  'wood_3',
] as const
/**
 * Town plaza — just south of the home street so it is on-screen at spawn.
 * (Tile → world: x = tx * TILE * SCALE)
 */
const CLEAR_CX = 18
const CLEAR_CY = 8
const CLEAR_RX = 10
const CLEAR_RY = 5

/**
 * Outdoor multiplayer meadow — Sprout Lands scenery + Eris Esra character anims.
 */
export class WorldScene extends Phaser.Scene {
  private petKey: PetKey = 'mochi'
  private petTint: PetTint = 'none'
  private playerName = 'Cat'
  private userId = ''
  private me?: Player
  private otherPlayers = new Map<string, Player>()
  private trees: ChopTree[] = []
  private homeNodes = new Map<string, Phaser.GameObjects.Container>()

  private unsubscribePositions: (() => void) | null = null
  private unsubscribeHomes: (() => void) | null = null
  private lastPositionUpdate = 0
  private heartbeatTimer?: Phaser.Time.TimerEvent
  private pruneTimer?: Phaser.Time.TimerEvent
  private lastKnownPeers = new Map<string, PlayerPosition>()
  private shuttingDown = false
  private faceStyle = 4
  private busyEmote = false
  private emoteMenu?: Phaser.GameObjects.Container
  private insideInterior = false

  constructor() {
    super('world')
  }

  init(data: WorldSceneData) {
    this.petKey = data.petKey ?? 'mochi'
    this.petTint = data.petTint ?? 'none'
    this.faceStyle = typeof data.faceStyle === 'number' ? data.faceStyle : 4
    this.playerName = data.playerName ?? 'Cat'
    this.userId = data.userId ?? ''
    this.shuttingDown = false
    this.busyEmote = false
    this.insideInterior = false
    this.emoteMenu?.destroy(true)
    this.emoteMenu = undefined
    this.lastPositionUpdate = 0
    this.lastKnownPeers.clear()
    this.otherPlayers.clear()
    this.trees = []
    this.homeNodes.clear()
  }

  preload() {
    const M = '/game/world/meadow'
    // Soft grass ground
    this.load.image('fill', `${M}/fill.png`)
    this.load.image('fill_b', `${M}/fill_b.png`)
    this.load.image('dirt', `${M}/dirt.png`)
    // Cozy Town free — fountain only (buildings clash with Sprout Lands)
    this.load.image('fountain', '/game/town/fountain.png')
    // Sparse edge trees / light deco
    for (const k of TREE_KEYS) this.load.image(k, `${M}/${k}.png`)
    for (const k of BUSH_KEYS) this.load.image(k, `${M}/${k}.png`)
    for (const k of DECO_KEYS) this.load.image(k, `${M}/${k}.png`)
    this.load.image('tree_stump', `${M}/stump.png`)
    this.load.image('picnic_basket', '/game/world/plants/picnic_basket.png')
    this.load.spritesheet('small_houses', '/game/world/village/small_houses.png', {
      frameWidth: 64,
      frameHeight: 64,
    })
    this.load.spritesheet('brick_houses', '/game/world/village/brick_houses.png', {
      frameWidth: 96,
      frameHeight: 80,
    })

    for (const anim of Object.keys(CHAR_SHEET_PATH) as CharAnim[]) {
      this.load.spritesheet(sheetKey(anim), CHAR_SHEET_PATH[anim], {
        frameWidth: CHAR_FRAME,
        frameHeight: CHAR_FRAME,
      })
    }
    this.load.spritesheet('expr_faces', EXPR_SHEET, {
      frameWidth: EXPR_FRAME,
      frameHeight: EXPR_FRAME,
    })
  }

  create() {
    for (const key of this.textures.getTextureKeys()) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
    }
    ensureLoopAnims(this)

    const worldW = MAP_W * TILE * SCALE
    const worldH = MAP_H * TILE * SCALE

    this.buildMeadow(worldW, worldH)
    this.placePaths()
    this.placeTownPlaza()
    this.placeTrees()
    this.placePlants()
    this.placePoiBuildings()

    // Spawn near house street; claimHome may refine position
    const startX = 140
    const startY = HOUSE_STREET_Y + 90
    this.createPlayerCharacter(startX, startY)

    this.cameras.main.setBounds(0, 0, worldW, worldH)
    this.cameras.main.startFollow(this.me!.sprite, true, 0.14, 0.14)

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.me || this.shuttingDown || this.insideInterior || this.busyEmote) return
      this.emoteMenu?.destroy(true)
      this.emoteMenu = undefined
      this.movePlayerTo(this.me.sprite, pointer.worldX, pointer.worldY, true)
    })

    void this.bootstrapHomesAndSync(startX, startY)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      void this.shutdownWorld()
    })
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      void this.shutdownWorld()
    })

    this.game.events.emit('world-ready', this)
  }

  /** Called after leaving a cafe/shop/park interior. */
  resumeFromInterior(returnX?: number, returnY?: number) {
    this.insideInterior = false
    if (this.me && returnX != null && returnY != null) {
      this.me.sprite.setPosition(returnX, returnY)
      this.me.nameText.setPosition(returnX, returnY - 48)
      this.me.sprite.setDepth(returnY)
      this.cameras.main.startFollow(this.me.sprite, true, 0.14, 0.14)
    }
  }

  /** Show a speech bubble + brief expression face above a player. */
  showSpeechBubble(userId: string, text: string) {
    const player =
      userId === this.userId || userId === 'me'
        ? this.me
        : this.otherPlayers.get(userId)
    if (!player) return

    player.bubble?.destroy()
    player.face?.destroy()

    const bubble = this.add.text(player.sprite.x, player.sprite.y - 56, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#1f2937',
      backgroundColor: '#fffffff2',
      padding: { x: 8, y: 5 },
      wordWrap: { width: 140 },
      align: 'center',
    })
    bubble.setOrigin(0.5, 1)
    bubble.setDepth(player.sprite.y + 20)
    player.bubble = bubble

    if (this.textures.exists('expr_faces')) {
      const face = this.add.image(
        player.sprite.x + 18,
        player.sprite.y - 48,
        'expr_faces',
        exprFrameIndex(exprForChat()),
      )
      face.setScale(2)
      face.setDepth(player.sprite.y + 21)
      player.face = face
      this.tweens.add({
        targets: face,
        alpha: 0,
        delay: 2800,
        duration: 350,
        onComplete: () => {
          face.destroy()
          if (player.face === face) player.face = undefined
        },
      })
    }

    this.tweens.add({
      targets: bubble,
      alpha: 0,
      delay: 3500,
      duration: 400,
      onComplete: () => {
        bubble.destroy()
        if (player.bubble === bubble) player.bubble = undefined
      },
    })
  }

  async shutdownWorld() {
    if (this.shuttingDown) return
    this.shuttingDown = true
    this.heartbeatTimer?.remove(false)
    this.pruneTimer?.remove(false)
    this.unsubscribePositions?.()
    this.unsubscribePositions = null
    this.unsubscribeHomes?.()
    this.unsubscribeHomes = null
    try {
      // Clears presence only — permanent homes stay in world_homes
      await leaveWorld()
    } catch (error) {
      console.error('[WorldScene] leaveWorld failed', error)
    }
  }

  private playCharAnim(
    sprite: Phaser.GameObjects.Sprite,
    anim: CharAnim,
    dir: CharDir,
  ) {
    playLoopAnim(this, sprite, anim, dir)
  }

  private applyCharTint(sprite: Phaser.GameObjects.Sprite, tint: PetTint) {
    sprite.setTint(CHAR_TINT[tint] ?? 0xffffff)
  }

  private openEmoteMenu() {
    if (!this.me || this.busyEmote || this.insideInterior) return
    this.emoteMenu?.destroy(true)
    this.emoteMenu = showEmoteMenu(
      this,
      this.me.sprite.x,
      this.me.sprite.y,
      (emote) => {
        if (!this.me) return
        this.busyEmote = true
        playEmote(this, this.me.sprite, emote, this.me.facing, () => {
          this.busyEmote = false
        })
        // Show preferred face briefly
        if (this.textures.exists('expr_faces')) {
          const face = this.add.image(
            this.me.sprite.x + 16,
            this.me.sprite.y - 50,
            'expr_faces',
            Phaser.Math.Clamp(this.faceStyle, 0, 17),
          )
          face.setScale(2.2)
          face.setDepth(this.me.sprite.y + 30)
          this.tweens.add({
            targets: face,
            alpha: 0,
            delay: 1200,
            duration: 300,
            onComplete: () => face.destroy(),
          })
        }
      },
    )
  }

  private enterInterior(kind: InteriorKind, label: string) {
    if (!this.me || this.insideInterior) return
    this.insideInterior = true
    this.emoteMenu?.destroy(true)
    this.emoteMenu = undefined
    this.scene.pause('world')
    this.scene.launch('interior', {
      kind,
      label,
      tint: this.petTint,
      returnX: this.me.sprite.x,
      returnY: this.me.sprite.y + 50,
    })
  }

  /** Elliptical distance from clearing center (1 = on rim). */
  private clearDist(tx: number, ty: number) {
    const nx = (tx - CLEAR_CX) / CLEAR_RX
    const ny = (ty - CLEAR_CY) / CLEAR_RY
    return Math.sqrt(nx * nx + ny * ny)
  }

  private buildMeadow(worldW: number, worldH: number) {
    this.cameras.main.setBackgroundColor(0xb7e27a)

    const s = SCALE
    const fillKey = this.textures.exists('fill') ? 'fill' : undefined
    if (fillKey) {
      const ground = this.add.tileSprite(worldW / 2, worldH / 2, worldW, worldH, fillKey)
      ground.setDepth(0)
      for (let i = 0; i < 280; i++) {
        const tx = Phaser.Math.Between(0, MAP_W - 1)
        const ty = Phaser.Math.Between(0, MAP_H - 1)
        if (!this.textures.exists('fill_b')) break
        const tile = this.add.image(
          tx * TILE * s + (TILE * s) / 2,
          ty * TILE * s + (TILE * s) / 2,
          'fill_b',
        )
        tile.setScale(s)
        tile.setAlpha(0.45)
        tile.setDepth(0.3)
      }
    } else {
      this.add.rectangle(worldW / 2, worldH / 2, worldW, worldH, 0xc0d872).setDepth(0)
    }
  }

  /** Paths linking homes → plaza → cafe / park / shop. */
  private placePaths() {
    const s = SCALE
    if (!this.textures.exists('dirt')) return

    const paint = (tx: number, ty: number) => {
      const x = tx * TILE * s + (TILE * s) / 2
      const y = ty * TILE * s + (TILE * s) / 2
      const dirt = this.add.image(x, y, 'dirt')
      dirt.setScale(s)
      dirt.setAlpha(0.9)
      dirt.setDepth(2)
    }

    // Plaza pad under fountain + paths to nearby POIs / homes
    for (let ty = CLEAR_CY - 1; ty <= CLEAR_CY + 2; ty++) {
      for (let tx = CLEAR_CX - 3; tx <= CLEAR_CX + 3; tx++) paint(tx, ty)
    }
    for (let tx = 4; tx <= 34; tx++) paint(tx, CLEAR_CY)
    for (let ty = 4; ty <= 14; ty++) paint(CLEAR_CX, ty)
    for (let tx = CLEAR_CX; tx <= 30; tx++) paint(tx, 6)
    for (let tx = 8; tx <= CLEAR_CX; tx++) paint(tx, 11)
  }

  /** Plaza hangout: Cozy Town fountain only (+ Sprout picnic at park). */
  private placeTownPlaza() {
    const s = SCALE
    const plazaX = CLEAR_CX * TILE * s
    const plazaY = CLEAR_CY * TILE * s

    if (this.textures.exists('fountain')) {
      const fountain = this.add.image(plazaX, plazaY, 'fountain')
      fountain.setScale(s * 2.2)
      fountain.setOrigin(0.5, 0.6)
      fountain.setDepth(plazaY + 2)
    }

    const plazaLabel = this.add.text(plazaX, plazaY - 64, 'Town Plaza', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#3d2914',
      backgroundColor: '#fff8e8cc',
      padding: { x: 8, y: 3 },
    })
    plazaLabel.setOrigin(0.5)
    plazaLabel.setDepth(3)

    if (this.textures.exists('picnic_basket')) {
      const basket = this.add.image(8 * TILE * s, 11 * TILE * s, 'picnic_basket')
      basket.setScale(s * 1.15)
      basket.setOrigin(0.5, 1)
      basket.setDepth(11 * TILE * s)
    }
  }

  private placePoiBuildings() {
    const s = SCALE
    type Poi = {
      label: string
      tx: number
      ty: number
      kind: InteriorKind
      enterHint: string
      frame: number
    }
    // Sprout Lands village buildings — matches trees/homes aesthetic
    const buildings: Poi[] = [
      {
        label: 'Fish Cafe',
        tx: 28,
        ty: 7,
        kind: 'cafe',
        enterHint: 'Enter cafe',
        frame: 2,
      },
      {
        label: 'Cat Shop',
        tx: 34,
        ty: 6,
        kind: 'shop',
        enterHint: 'Enter shop',
        frame: 1,
      },
      {
        label: 'Park',
        tx: 8,
        ty: 11,
        kind: 'park',
        enterHint: 'Enter park',
        frame: 0,
      },
    ]

    for (const b of buildings) {
      const x = b.tx * TILE * s
      const y = b.ty * TILE * s
      const container = this.add.container(x, y)
      container.setDepth(y)

      if (this.textures.exists('brick_houses')) {
        const house = this.add.image(0, 0, 'brick_houses', b.frame)
        house.setScale(1.7)
        house.setOrigin(0.5, 1)
        container.add(house)
      } else {
        const body = this.add.rectangle(0, -18, 72, 52, 0xc4b8a8)
        body.setStrokeStyle(2, 0x5c4033)
        container.add(body)
      }

      if (b.kind === 'park' && this.textures.exists('picnic_basket')) {
        const basket = this.add.image(28, -4, 'picnic_basket')
        basket.setScale(s)
        basket.setOrigin(0.5, 1)
        container.add(basket)
      }

      const label = this.add.text(0, 6, b.label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#3d2914',
        backgroundColor: '#fff8e8ee',
        padding: { x: 6, y: 2 },
      })
      label.setOrigin(0.5, 0)
      container.add(label)

      const hint = this.add.text(0, 22, b.enterHint, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '10px',
        color: '#5c4033',
        backgroundColor: '#d4f0c8ee',
        padding: { x: 5, y: 2 },
      })
      hint.setOrigin(0.5, 0)
      container.add(hint)

      const zone = this.add.zone(0, -36, 120, 110)
      zone.setInteractive({ useHandCursor: true })
      container.add(zone)
      zone.on(
        'pointerdown',
        (
          _p: Phaser.Input.Pointer,
          _x: number,
          _y: number,
          e: Phaser.Types.Input.EventData,
        ) => {
          e.stopPropagation()
          if (!this.me || this.insideInterior) return
          this.movePlayerTo(this.me.sprite, x, y + 36, true, () => {
            this.enterInterior(b.kind, b.label)
            this.game.events.emit('world-poi', { kind: b.kind, label: b.label })
          })
        },
      )
    }
  }

  /**
   * Sprout Lands village cottage (complete sprite, not a tileset).
   * Label: "{playerName} Home" — click own home to return to room.
   */
  private placePlayerHome(home: WorldHome) {
    const existing = this.homeNodes.get(home.userId)
    if (existing) {
      const label = existing.getData('label') as Phaser.GameObjects.Text | undefined
      label?.setText(`${home.playerName} Home`)
      return
    }

    const x = home.plotX
    const y = home.plotY
    const isMine = home.userId === this.userId
    const frame = ((home.slotIndex % 9) + 9) % 9
    const container = this.add.container(x, y)
    container.setDepth(y)

    if (this.textures.exists('small_houses')) {
      const house = this.add.image(0, 0, 'small_houses', frame)
      house.setScale(HOUSE_SCALE)
      house.setOrigin(0.5, 1)
      container.add(house)
    } else {
      const wall = this.add.rectangle(0, -20, 48, 32, 0xe8d4b0, 1)
      wall.setStrokeStyle(2, 0x8b6914)
      container.add(wall)
    }

    const label = this.add.text(0, 6, `${home.playerName} Home`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: isMine ? '#1d4d2b' : '#3d2914',
      backgroundColor: '#fff8e8ee',
      padding: { x: 6, y: 2 },
    })
    label.setOrigin(0.5, 0)
    container.setData('label', label)
    container.add(label)

    const zone = this.add.zone(0, -40, 90, 90)
    zone.setInteractive({ useHandCursor: true })
    container.add(zone)

    zone.on(
      'pointerdown',
      (
        _p: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        e: Phaser.Types.Input.EventData,
      ) => {
        e.stopPropagation()
        if (isMine) {
          void this.shutdownWorld().finally(() =>
            this.game.events.emit('exit-to-room'),
          )
        } else {
          this.game.events.emit('world-poi', {
            kind: 'home',
            label: `${home.playerName} Home`,
          })
        }
      },
    )

    this.homeNodes.set(home.userId, container)
  }

  private applyHomes(homes: WorldHome[]) {
    const seen = new Set(homes.map((h) => h.userId))
    for (const home of homes) this.placePlayerHome(home)
    for (const id of [...this.homeNodes.keys()]) {
      if (!seen.has(id)) {
        this.homeNodes.get(id)?.destroy(true)
        this.homeNodes.delete(id)
      }
    }
  }

  private async bootstrapHomesAndSync(fallbackX: number, fallbackY: number) {
    let startX = fallbackX
    let startY = fallbackY
    try {
      const mine = await claimWorldHome(this.playerName)
      startX = mine.plotX
      startY = mine.plotY + 80
      if (this.me) {
        this.me.sprite.setPosition(startX, startY)
        this.me.nameText.setPosition(startX, startY - 48)
        this.me.sprite.setDepth(startY)
      }
      const homes = await fetchWorldHomes()
      this.applyHomes(homes)
      this.unsubscribeHomes = subscribeToWorldHomes((next) => {
        if (!this.shuttingDown) this.applyHomes(next)
      })
    } catch (error) {
      console.error('[WorldScene] homes failed', error)
      this.game.events.emit('world-error', error)
      // Fallback: still show a local cottage so the street isn't empty
      this.placePlayerHome({
        userId: this.userId || 'local',
        playerName: this.playerName,
        slotIndex: 0,
        plotX: HOUSE_BASE_X,
        plotY: HOUSE_STREET_Y,
      })
    }
    void this.startMultiplayerSync(startX, startY)
  }

  private placeTrees() {
    const s = SCALE
    // Sparse edge groves only — leave plaza / paths open for multiplayer
    for (let ty = 3; ty < MAP_H - 1; ty++) {
      for (let tx = 1; tx < MAP_W - 1; tx++) {
        const d = this.clearDist(tx, ty)
        if (d < 1.05) continue // open plaza around fountain
        if (tx >= 25 && tx <= 36 && ty >= 4 && ty <= 10) continue // cafe/shop
        if (tx >= 6 && tx <= 12 && ty >= 9 && ty <= 13) continue // park
        if (Math.abs(ty * TILE * s - HOUSE_STREET_Y) < 90 && tx < 32) continue

        // Only near map edges, low chance
        const nearEdge = tx <= 4 || tx >= MAP_W - 5 || ty <= 6 || ty >= MAP_H - 4
        const chance = nearEdge ? 28 : d > 1.4 ? 12 : 0
        if (chance === 0 || Phaser.Math.Between(0, 100) >= chance) continue

        const x = (tx + Phaser.Math.FloatBetween(-0.25, 0.25)) * TILE * s
        const y = (ty + Phaser.Math.FloatBetween(-0.2, 0.2)) * TILE * s
        const key = TREE_KEYS[Phaser.Math.Between(0, TREE_KEYS.length - 1)]
        if (!this.textures.exists(key)) continue

        const sprite = this.add.image(x, y, key)
        const big = key === 't_oak' || key === 't_birch' || key === 't_pine'
        sprite.setScale(s * (big ? 1.0 : 1.15))
        sprite.setOrigin(0.5, 1)
        sprite.setDepth(y)
        sprite.setInteractive({ useHandCursor: true })
        const tree: ChopTree = { sprite, chopped: false }
        this.trees.push(tree)
        sprite.on(
          'pointerdown',
          (
            _p: Phaser.Input.Pointer,
            _x: number,
            _y: number,
            e: Phaser.Types.Input.EventData,
          ) => {
            e.stopPropagation()
            this.chopTree(tree)
          },
        )
      }
    }
  }

  private chopTree(tree: ChopTree) {
    if (tree.chopped) return
    tree.chopped = true
    this.tweens.add({
      targets: tree.sprite,
      angle: Phaser.Math.Between(-70, 70),
      alpha: 0.15,
      duration: 420,
      ease: 'Back.easeIn',
      onComplete: () => {
        const { x, y } = tree.sprite
        tree.sprite.destroy()
        if (this.textures.exists('tree_stump')) {
          const stump = this.add.image(x, y, 'tree_stump')
          stump.setScale(SCALE * 1.2)
          stump.setOrigin(0.5, 1)
          stump.setDepth(y)
        }
        this.game.events.emit('world-tree-chopped')
      },
    })
  }

  private placePlants() {
    const s = SCALE
    // Light decor — keep walkways clear for hanging out
    for (let i = 0; i < 70; i++) {
      const tx = Phaser.Math.FloatBetween(4, MAP_W - 4)
      const ty = Phaser.Math.FloatBetween(8, MAP_H - 3)
      const d = this.clearDist(tx, ty)
      // Skip plaza center and main path cross
      if (d < 0.45) continue
      if (Math.abs(tx - CLEAR_CX) < 1.2 || Math.abs(ty - CLEAR_CY) < 1.2) continue
      const x = tx * TILE * s
      const y = ty * TILE * s
      const key = DECO_KEYS[Phaser.Math.Between(0, DECO_KEYS.length - 1)]
      if (!this.textures.exists(key)) continue
      const deco = this.add.image(x, y, key)
      deco.setScale(s)
      deco.setOrigin(0.5, 1)
      deco.setDepth(y - 1)
    }

    // A few bushes near map edges only
    for (let i = 0; i < 18; i++) {
      const tx = Phaser.Math.Between(1, 5) + (i % 2 === 0 ? 0 : MAP_W - 7)
      const ty = Phaser.Math.Between(8, MAP_H - 3)
      const key = BUSH_KEYS[Phaser.Math.Between(0, BUSH_KEYS.length - 1)]
      if (!this.textures.exists(key)) continue
      const x = tx * TILE * s
      const y = ty * TILE * s
      const bush = this.add.image(x, y, key)
      bush.setScale(s * 1.2)
      bush.setOrigin(0.5, 1)
      bush.setDepth(y)
    }
  }

  private createPlayerCharacter(x: number, y: number) {
    const sprite = this.add.sprite(x, y, sheetKey('idle'), 0)
    sprite.setScale(2.6)
    sprite.setOrigin(0.5, 0.95)
    sprite.setDepth(y)
    this.applyCharTint(sprite, this.petTint)
    this.playCharAnim(sprite, 'idle', 's')
    sprite.setInteractive({ useHandCursor: true })
    sprite.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation()
        this.openEmoteMenu()
      },
    )

    const nameText = this.add.text(x, y - 48, this.playerName, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#2d1f14',
      backgroundColor: '#ffffffee',
      padding: { x: 6, y: 2 },
    })
    nameText.setOrigin(0.5, 1)
    nameText.setDepth(y + 1)

    this.me = {
      sprite,
      nameText,
      playerId: this.userId || 'me',
      petKey: this.petKey,
      tint: this.petTint,
      facing: 's',
      isMe: true,
    }
  }

  private movePlayerTo(
    sprite: Phaser.GameObjects.Sprite,
    targetX: number,
    targetY: number,
    isLocal = false,
    onArrive?: () => void,
  ) {
    if (this.busyEmote && isLocal) return
    const worldW = MAP_W * TILE * SCALE
    const worldH = MAP_H * TILE * SCALE
    const x = Phaser.Math.Clamp(targetX, 40, worldW - 40)
    const y = Phaser.Math.Clamp(targetY, 40, worldH - 40)

    this.tweens.killTweensOf(sprite)
    const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, x, y)
    const duration = Phaser.Math.Clamp(distance * 2.4, 160, 1100)

    const owner =
      isLocal || sprite === this.me?.sprite
        ? this.me
        : [...this.otherPlayers.values()].find((p) => p.sprite === sprite)

    if (distance < 6) {
      onArrive?.()
      return
    }

    const dir = dirFromDelta(x - sprite.x, y - sprite.y)
    if (owner) owner.facing = dir
    const moveAnim: CharAnim = distance > 220 ? 'run' : 'walk'
    this.playCharAnim(sprite, moveAnim, dir)

    if (isLocal) void this.broadcastMyPosition(x, y)

    this.tweens.add({
      targets: sprite,
      x,
      y,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        sprite.setDepth(sprite.y)
        owner?.nameText.setPosition(sprite.x, sprite.y - 48)
        owner?.nameText.setDepth(sprite.y + 1)
        owner?.bubble?.setPosition(sprite.x, sprite.y - 56)
        owner?.bubble?.setDepth(sprite.y + 20)
        owner?.face?.setPosition(sprite.x + 18, sprite.y - 48)
        owner?.face?.setDepth(sprite.y + 21)
      },
      onComplete: () => {
        this.playCharAnim(sprite, 'idle', owner?.facing ?? dir)
        if (isLocal) void this.broadcastMyPosition(x, y, true)
        onArrive?.()
      },
    })
  }

  private async startMultiplayerSync(startX: number, startY: number) {
    if (!this.userId) return
    try {
      await this.broadcastMyPosition(startX, startY, true)
      this.applyPeerSnapshot(await fetchActivePlayers(this.userId))
      this.unsubscribePositions = subscribeToPlayerPositions(this.userId, (players) => {
        if (!this.shuttingDown) this.applyPeerSnapshot(players)
      })
      this.heartbeatTimer = this.time.addEvent({
        delay: HEARTBEAT_MS,
        loop: true,
        callback: () => {
          if (!this.me || this.shuttingDown) return
          void this.broadcastMyPosition(this.me.sprite.x, this.me.sprite.y, true)
        },
      })
      this.pruneTimer = this.time.addEvent({
        delay: 5_000,
        loop: true,
        callback: () => this.pruneInactivePeers(),
      })
    } catch (error) {
      console.error('[WorldScene] sync failed', error)
      this.game.events.emit('world-error', error)
    }
  }

  private applyPeerSnapshot(players: PlayerPosition[]) {
    const active = new Set<string>()
    const now = Date.now()
    for (const p of players) {
      if (p.userId === this.userId) continue
      if (now - new Date(p.updatedAt).getTime() > INACTIVE_MS) continue
      active.add(p.userId)
      this.lastKnownPeers.set(p.userId, p)
      const existing = this.otherPlayers.get(p.userId)
      if (!existing) {
        void this.spawnOtherPlayer(p)
      } else {
        existing.nameText.setText(p.playerName)
        this.moveRemote(existing, p.worldX, p.worldY)
      }
    }
    for (const id of [...this.otherPlayers.keys()]) {
      if (!active.has(id)) {
        this.removeOtherPlayer(id)
        this.lastKnownPeers.delete(id)
      }
    }
  }

  private async spawnOtherPlayer(p: PlayerPosition) {
    const pet = (p.petKey === 'pochi' ? 'pochi' : 'mochi') as PetKey
    const tint = (p.petTint || 'none') as PetTint

    const sprite = this.add.sprite(p.worldX, p.worldY, sheetKey('idle'), 0)
    sprite.setScale(2.6)
    sprite.setOrigin(0.5, 0.95)
    sprite.setDepth(p.worldY)
    this.applyCharTint(sprite, tint)
    this.playCharAnim(sprite, 'idle', 's')

    const nameText = this.add.text(p.worldX, p.worldY - 48, p.playerName, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#7a2f55',
      backgroundColor: '#ffffffee',
      padding: { x: 6, y: 2 },
    })
    nameText.setOrigin(0.5, 1)
    nameText.setDepth(p.worldY + 1)

    this.otherPlayers.set(p.userId, {
      sprite,
      nameText,
      playerId: p.userId,
      petKey: pet,
      tint,
      facing: 's',
      isMe: false,
    })
  }

  private moveRemote(player: Player, x: number, y: number) {
    if (Math.abs(player.sprite.x - x) < 4 && Math.abs(player.sprite.y - y) < 4) {
      player.sprite.setPosition(x, y)
      player.nameText.setPosition(x, y - 48)
      return
    }
    this.movePlayerTo(player.sprite, x, y, false)
  }

  private pruneInactivePeers() {
    const now = Date.now()
    for (const [id, peer] of this.lastKnownPeers) {
      if (now - new Date(peer.updatedAt).getTime() > INACTIVE_MS) {
        this.removeOtherPlayer(id)
        this.lastKnownPeers.delete(id)
      }
    }
  }

  private removeOtherPlayer(playerId: string) {
    const player = this.otherPlayers.get(playerId)
    if (!player) return
    this.tweens.killTweensOf(player.sprite)
    player.sprite.destroy()
    player.nameText.destroy()
    player.bubble?.destroy()
    player.face?.destroy()
    this.otherPlayers.delete(playerId)
  }

  private async broadcastMyPosition(x: number, y: number, force = false) {
    if (!this.userId || this.shuttingDown) return
    const now = Date.now()
    if (!force && now - this.lastPositionUpdate < POSITION_THROTTLE_MS) return
    this.lastPositionUpdate = now
    try {
      await pushMyPosition(this.playerName, x, y, this.petKey, this.petTint)
    } catch (error) {
      console.error('[WorldScene] position push failed', error)
      this.game.events.emit('world-error', error)
    }
  }
}
