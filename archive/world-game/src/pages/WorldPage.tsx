import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Phaser from 'phaser'
import { toast } from 'react-toastify'
import { Send } from 'lucide-react'
import { createGameConfig } from '@/game/gameConfig'
import type { WorldScene } from '@/game/scenes/WorldScene'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { toUserFacingError } from '@/utils/userFacingError'
import * as api from '@/services/api'
import type { WorldChatMessage } from '@/services/world'

export function WorldPage() {
  const { currentUser } = useApp()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<WorldScene | null>(null)
  // Chat ids already shown as bubbles (own messages arrive twice: once from
  // the insert response, once from realtime).
  const bubbledIdsRef = useRef<Set<string>>(new Set())
  const userId = currentUser?.id ?? null
  const petKey = currentUser?.avatarConfig.pet ?? null
  const tint = currentUser?.avatarConfig.tint ?? 'none'
  const faceStyle = currentUser?.avatarConfig.faceStyle ?? 4

  const [chatLog, setChatLog] = useState<WorldChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!containerRef.current || !petKey || !currentUser) return
    const container = containerRef.current
    container.innerHTML = ''

    const game = new Phaser.Game(createGameConfig(container, 'world'))
    let toasted = false

    const onReady = (scene: WorldScene) => {
      sceneRef.current = scene
    }
    const onError = (error: unknown) => {
      console.error('[WorldPage]', error)
      if (toasted) return
      toasted = true
      const raw = error instanceof Error ? error.message : ''
      toast.error(
        raw.toLowerCase().includes('upsert_player_position') ||
          raw.toLowerCase().includes('world sync')
          ? t.room.worldSetupHint
          : toUserFacingError(error, t.auth.authFailed),
        { toastId: 'world-sync-error' },
      )
    }
    const onExitRoom = () => navigate('/room')
    const onPoi = (payload: { kind: string; label: string }) => {
      toast.success(t.room.poiEntered.replace('{place}', payload.label), {
        toastId: `poi-${payload.kind}`,
      })
    }
    const onTree = () => {
      toast.success(t.room.treeChopped, { toastId: `tree-${Date.now()}` })
    }
    const onInteriorAction = (payload: { message: string }) => {
      toast.info(payload.message, { toastId: `interior-${Date.now()}` })
    }
    const onExitInterior = (payload: { returnX?: number; returnY?: number }) => {
      sceneRef.current?.resumeFromInterior(payload.returnX, payload.returnY)
    }

    game.events.on('world-ready', onReady)
    game.events.on('world-error', onError)
    game.events.on('exit-to-room', onExitRoom)
    game.events.on('world-poi', onPoi)
    game.events.on('world-tree-chopped', onTree)
    game.events.on('interior-action', onInteriorAction)
    game.events.on('exit-interior', onExitInterior)

    game.scene.start('world', {
      petKey,
      petTint: tint,
      faceStyle,
      playerName: currentUser.name,
      userId: currentUser.id,
    })

    return () => {
      game.events.off('world-ready', onReady)
      game.events.off('world-error', onError)
      game.events.off('exit-to-room', onExitRoom)
      game.events.off('world-poi', onPoi)
      game.events.off('world-tree-chopped', onTree)
      game.events.off('interior-action', onInteriorAction)
      game.events.off('exit-interior', onExitInterior)
      const scene = sceneRef.current
      sceneRef.current = null
      void scene?.shutdownWorld().finally(() => game.destroy(true))
    }
  }, [petKey, tint, faceStyle, currentUser?.id, currentUser?.name, t, navigate])

  const showBubbleOnce = useCallback((message: WorldChatMessage) => {
    if (bubbledIdsRef.current.has(message.id)) return
    bubbledIdsRef.current.add(message.id)
    sceneRef.current?.showSpeechBubble(message.userId, message.content)
  }, [])

  const appendChat = useCallback((message: WorldChatMessage) => {
    setChatLog((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev
      return [...prev.slice(-50), message]
    })
  }, [])

  // World chat feed (keyed on user id so profile refreshes don't resubscribe)
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void api
      .fetchRecentWorldChat(40)
      .then((history) => {
        if (cancelled) return
        // Merge with anything realtime delivered while history was loading
        setChatLog((prev) => {
          const ids = new Set(history.map((m) => m.id))
          return [...history, ...prev.filter((m) => !ids.has(m.id))].slice(-50)
        })
      })
      .catch((error) => console.warn('[world chat]', error))

    const unsub = api.subscribeToWorldChat((message) => {
      appendChat(message)
      showBubbleOnce(message)
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [userId, appendChat, showBubbleOnce])

  const sendChat = async (event: FormEvent) => {
    event.preventDefault()
    if (!currentUser || !draft.trim() || sending) return
    setSending(true)
    const text = draft.trim()
    setDraft('')
    try {
      const message = await api.sendWorldChat(currentUser.name, text)
      appendChat(message)
      showBubbleOnce(message)
    } catch (error) {
      console.error(error)
      setDraft(text)
      toast.error(toUserFacingError(error, t.room.chatFailed))
    } finally {
      setSending(false)
    }
  }

  if (!currentUser) return null
  if (!petKey) return <Navigate to="/avatar" replace />

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <h2 className="font-brand text-2xl font-bold text-slate-700 dark:text-slate-100">
              {t.room.worldTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.room.worldHint}
            </p>
          </div>
          <Link to="/room" className="btn-soft">
            {t.room.backToRoom}
          </Link>
        </div>
        <div className="card-panel overflow-hidden p-0">
          <div
            ref={containerRef}
            className="aspect-video w-full bg-sky-200/80 [&_canvas]:[image-rendering:pixelated]"
          />
        </div>
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          {t.room.worldControls}
        </p>
        <p className="text-center text-[10px] text-slate-400">
          Fountain: Cozy Town free · Interiors: Interior free · World/homes: Sprout Lands ·
          Characters: Eris Esra
        </p>
      </div>

      <aside className="card-panel flex h-[min(70vh,640px)] flex-col overflow-hidden p-0">
        <div className="border-b border-purple-100/40 px-4 py-3 dark:border-purple-500/20">
          <p className="font-brand text-base font-bold text-slate-700 dark:text-slate-100">
            {t.room.worldChat}
          </p>
          <p className="text-[11px] text-slate-400">{t.room.worldChatHint}</p>
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {chatLog.length === 0 ? (
            <li className="py-8 text-center text-xs text-slate-400">
              {t.room.worldChatEmpty}
            </li>
          ) : (
            chatLog.map((msg) => (
              <li key={msg.id} className="text-sm">
                <span className="font-bold text-pink-500">@{msg.playerName}</span>{' '}
                <span className="text-slate-600 dark:text-slate-300">{msg.content}</span>
              </li>
            ))
          )}
        </ul>
        <form
          onSubmit={(event) => void sendChat(event)}
          className="flex gap-2 border-t border-purple-100/40 p-3 dark:border-purple-500/20"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={120}
            placeholder={t.room.worldChatPlaceholder}
            className="input-field"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="btn-primary h-10 px-3"
            aria-label={t.messages.send}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </aside>
    </div>
  )
}
