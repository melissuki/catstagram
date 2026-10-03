import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Phaser from 'phaser'
import { toast } from 'react-toastify'
import { Pencil, Check, Heart, ShoppingBag, Utensils } from 'lucide-react'
import { createGameConfig } from '@/game/gameConfig'
import { furnitureTexturePath } from '@/game/petCatalog'
import type { RoomFurniturePlacement, RoomScene } from '@/game/scenes/RoomScene'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import * as api from '@/services/api'
import type { InventoryItem } from '@/types/shop'

export function RoomPage() {
  const { currentUser } = useApp()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<RoomScene | null>(null)
  const initialFurnitureRef = useRef<RoomFurniturePlacement[]>([])
  const petKey = currentUser?.avatarConfig.pet ?? null
  const tint = currentUser?.avatarConfig.tint ?? 'none'

  const [dataReady, setDataReady] = useState(false)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [placedKeys, setPlacedKeys] = useState<Set<string>>(new Set())
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!currentUser || !petKey) return
    let cancelled = false

    void (async () => {
      try {
        const [room, myInventory, catalog] = await Promise.all([
          api.fetchOrCreateRoom(),
          api.fetchMyInventory(currentUser.id),
          api.fetchShopItems(),
        ])
        if (cancelled) return

        const spriteKeyByItemKey = new Map(catalog.map((item) => [item.key, item.spriteKey]))
        const placements = room.layout
          .map((entry): RoomFurniturePlacement | null => {
            const spriteKey = spriteKeyByItemKey.get(entry.itemKey)
            return spriteKey ? { itemKey: entry.itemKey, spriteKey, x: entry.x, y: entry.y } : null
          })
          .filter((placement): placement is RoomFurniturePlacement => placement !== null)

        initialFurnitureRef.current = placements
        setPlacedKeys(new Set(placements.map((p) => p.itemKey)))
        setInventory(myInventory)
        setDataReady(true)
      } catch (error) {
        console.error('[room]', error)
        toast.error(t.auth.authFailed)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentUser, petKey, t.auth.authFailed])

  useEffect(() => {
    if (!containerRef.current || !petKey || !dataReady) return
    const container = containerRef.current
    // Defensive: React StrictMode double-invokes effects in dev, and a
    // leftover canvas from the first pass can corrupt the second Phaser
    // instance's pointer coordinate transform (worldX/Y stuck at 0).
    container.innerHTML = ''
    const game = new Phaser.Game(createGameConfig(container))
    const onReady = (scene: RoomScene) => {
      sceneRef.current = scene
    }
    const onExitWorld = () => {
      navigate('/world')
    }
    const onToast = (payload: { kind: string; action?: string }) => {
      if (payload.kind === 'played') toast.success(t.room.petPlayed)
      else if (payload.kind === 'fed') toast.success(t.room.petFed)
      else if (payload.kind === 'too-far') toast.info(t.room.petTooFar)
    }
    game.events.on('room-ready', onReady)
    game.events.on('exit-to-world', onExitWorld)
    game.events.on('room-toast', onToast)
    game.scene.start('boot', { petKey, tint, furniture: initialFurnitureRef.current })

    return () => {
      game.events.off('room-ready', onReady)
      game.events.off('exit-to-world', onExitWorld)
      game.events.off('room-toast', onToast)
      sceneRef.current = null
      game.destroy(true)
    }
  }, [petKey, tint, dataReady, navigate, t.room.petFed, t.room.petPlayed, t.room.petTooFar])

  if (!currentUser) return null
  if (!petKey) return <Navigate to="/avatar" replace />

  const unplacedInventory = inventory.filter((item) => !placedKeys.has(item.itemKey))
  const placedInventory = inventory.filter((item) => placedKeys.has(item.itemKey))

  const enterEditMode = () => {
    setEditMode(true)
    sceneRef.current?.setEditMode(true)
  }

  const placeItem = (item: InventoryItem) => {
    sceneRef.current?.placeFurniture(item.itemKey, item.spriteKey)
    setPlacedKeys((prev) => new Set(prev).add(item.itemKey))
  }

  const removeItem = (item: InventoryItem) => {
    sceneRef.current?.removeFurniture(item.itemKey)
    setPlacedKeys((prev) => {
      const next = new Set(prev)
      next.delete(item.itemKey)
      return next
    })
  }

  const saveAndExit = async () => {
    if (!sceneRef.current || !currentUser) return
    setSaving(true)
    try {
      // Re-run ensure so starter furniture is granted if missing (fixes old rooms)
      await api.fetchOrCreateRoom()
      const freshInventory = await api.fetchMyInventory(currentUser.id)
      setInventory(freshInventory)
      const owned = new Set(freshInventory.map((item) => item.itemKey))

      const layout = sceneRef.current
        .getLayout()
        .filter((entry) => owned.has(entry.itemKey))
        .map(({ itemKey, x, y }) => ({ itemKey, x, y }))

      if (layout.length === 0) {
        toast.error(t.room.saveNoOwned)
        return
      }

      await api.saveRoomLayout(layout)
      toast.success(t.room.saved)
      sceneRef.current.setEditMode(false)
      setEditMode(false)
    } catch (error) {
      console.error('[room]', error)
      const message = error instanceof Error ? error.message : ''
      toast.error(
        message.toLowerCase().includes('not owned')
          ? t.room.saveNotOwned
          : t.room.saveFailed,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-brand text-2xl font-bold text-slate-700 dark:text-slate-100">
            {t.room.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.room.roomHint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!editMode ? (
            <>
              <Link to="/shop" className="btn-soft">
                <ShoppingBag className="h-4 w-4" />
                {t.nav.shop}
              </Link>
              <button
                type="button"
                onClick={() => sceneRef.current?.playWithPet()}
                className="btn-soft"
              >
                <Heart className="h-4 w-4" />
                {t.room.playPet}
              </button>
              <button
                type="button"
                onClick={() => sceneRef.current?.feedPet()}
                className="btn-soft"
              >
                <Utensils className="h-4 w-4" />
                {t.room.feedPet}
              </button>
            </>
          ) : null}
          <p className="hidden items-center text-xs text-slate-500 sm:flex dark:text-slate-400">
            {t.room.doorHint}
          </p>
          {editMode ? (
            <button
              type="button"
              onClick={() => void saveAndExit()}
              disabled={saving}
              className="btn-primary-sm"
            >
              <Check className="h-4 w-4" />
              {saving ? t.common.loading : t.room.save}
            </button>
          ) : (
            <button type="button" onClick={enterEditMode} className="btn-soft">
              <Pencil className="h-4 w-4" />
              {t.room.edit}
            </button>
          )}
        </div>
      </div>

      <div className="card-panel overflow-hidden p-0">
        <div ref={containerRef} className="aspect-[4/3] w-full" />
      </div>

      {editMode ? (
        <div className="card-panel animate-fade-up space-y-4 p-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t.room.yourItems}
            </p>
            {unplacedInventory.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t.room.noUnplacedItems}
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {unplacedInventory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => placeItem(item)}
                    className="flex flex-col items-center gap-1"
                    title={t.room.place}
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 p-1.5 dark:from-purple-950/40 dark:via-pink-950/30 dark:to-orange-950/20">
                      <img
                        src={furnitureTexturePath(item.spriteKey)}
                        alt={item.itemKey}
                        className="h-full w-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {placedInventory.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t.room.placed}
              </p>
              <div className="flex flex-wrap gap-3">
                {placedInventory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => removeItem(item)}
                    className="flex flex-col items-center gap-1"
                    title={t.room.remove}
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-pink-300/70 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 p-1.5 dark:from-purple-950/40 dark:via-pink-950/30 dark:to-orange-950/20">
                      <img
                        src={furnitureTexturePath(item.spriteKey)}
                        alt={item.itemKey}
                        className="h-full w-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
