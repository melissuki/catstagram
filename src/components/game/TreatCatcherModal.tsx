import { useCallback, useEffect, useRef, useState } from 'react'
import { Gamepad2, X } from 'lucide-react'
import { toast } from 'react-toastify'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'

const GAME_SECONDS = 30
const POINTS_PER_CATCH = 10
const SPAWN_MS = 700

type Treat = {
  id: number
  x: number
  y: number
  emoji: string
  drift: number
}

const TREATS = ['🐟', '🍗', '🍤', '🧶', '🐾', '🧀']

interface TreatCatcherModalProps {
  open: boolean
  onClose: () => void
}

export function TreatCatcherModal({ open, onClose }: TreatCatcherModalProps) {
  const { currentUser, submitGameScore } = useApp()
  const { t } = useTranslation()
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle')
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS)
  const [treats, setTreats] = useState<Treat[]>([])
  const nextId = useRef(1)
  const scoreRef = useRef(0)

  const reset = useCallback(() => {
    setPhase('idle')
    setScore(0)
    scoreRef.current = 0
    setTimeLeft(GAME_SECONDS)
    setTreats([])
    nextId.current = 1
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  useEffect(() => {
    if (phase !== 'playing') return

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer)
          setPhase('done')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'done') return
    void (async () => {
      try {
        const result = await submitGameScore(scoreRef.current)
        if (result.isNewHigh) {
          toast.success(t.game.newHighScore)
        }
      } catch (error) {
        console.error(error)
        toast.error(t.game.saveFailed)
      }
    })()
  }, [phase, submitGameScore, t.game.newHighScore, t.game.saveFailed])

  useEffect(() => {
    if (phase !== 'playing') return

    const spawn = window.setInterval(() => {
      setTreats((prev) => {
        const next: Treat = {
          id: nextId.current++,
          x: 8 + Math.random() * 76,
          y: 10 + Math.random() * 70,
          emoji: TREATS[Math.floor(Math.random() * TREATS.length)]!,
          drift: (Math.random() - 0.5) * 12,
        }
        return [...prev.slice(-14), next]
      })
    }, SPAWN_MS)

    const move = window.setInterval(() => {
      setTreats((prev) =>
        prev
          .map((item) => ({
            ...item,
            y: item.y + 1.2,
            x: Math.min(90, Math.max(4, item.x + item.drift * 0.08)),
          }))
          .filter((item) => item.y < 95),
      )
    }, 50)

    return () => {
      window.clearInterval(spawn)
      window.clearInterval(move)
    }
  }, [phase])

  if (!open || !currentUser) return null

  const catchTreat = (id: number) => {
    if (phase !== 'playing') return
    setTreats((prev) => prev.filter((item) => item.id !== id))
    setScore((prev) => {
      const next = prev + POINTS_PER_CATCH
      scoreRef.current = next
      return next
    })
  }

  const start = () => {
    scoreRef.current = 0
    setScore(0)
    setTimeLeft(GAME_SECONDS)
    setTreats([])
    setPhase('playing')
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t.game.title}
    >
      <div className="card-panel relative w-full max-w-lg overflow-hidden p-0 shadow-2xl">
        <div className="flex items-center justify-between border-b border-purple-100/40 bg-gradient-to-r from-purple-50 via-pink-50/80 to-orange-50/60 px-4 py-3 dark:border-purple-500/20 dark:from-slate-950 dark:via-purple-950/40 dark:to-slate-900">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-pink-500" />
            <div>
              <p className="font-brand text-base font-bold text-slate-700 dark:text-slate-100">
                {t.game.title}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t.game.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/70 p-2 text-slate-500 transition hover:text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            aria-label={t.common.back}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <span>
            {t.game.score}:{' '}
            <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-transparent">
              {score}
            </span>
          </span>
          <span>
            {t.game.time}: {timeLeft}s
          </span>
          <span>
            {t.game.best}: {currentUser.gameHighScore}
          </span>
        </div>

        <div className="relative mx-3 mb-3 h-[340px] overflow-hidden rounded-2xl border border-purple-100/50 bg-gradient-to-b from-purple-50/80 via-pink-50/50 to-orange-50/60 dark:border-purple-500/20 dark:from-slate-900 dark:via-purple-950/30 dark:to-slate-950 sm:h-[400px]">
          {phase === 'idle' ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-4xl">🐱</p>
              <p className="max-w-xs text-sm text-slate-600 dark:text-slate-300">
                {t.game.howto}
              </p>
              <button type="button" onClick={start} className="btn-primary">
                <Gamepad2 className="h-4 w-4" />
                {t.game.play}
              </button>
            </div>
          ) : null}

          {phase === 'playing'
            ? treats.map((treat) => (
                <button
                  key={treat.id}
                  type="button"
                  onClick={() => catchTreat(treat.id)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 animate-soft-pulse text-3xl drop-shadow-md transition hover:scale-125 active:scale-95"
                  style={{ left: `${treat.x}%`, top: `${treat.y}%` }}
                  aria-label={t.game.catchTreat}
                >
                  {treat.emoji}
                </button>
              ))
            : null}

          {phase === 'done' ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="font-brand text-2xl font-bold text-slate-700 dark:text-slate-100">
                {t.game.gameOver}
              </p>
              <p className="text-lg font-semibold text-pink-500">
                {t.game.score}: {score}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t.game.best}: {Math.max(currentUser.gameHighScore, score)}
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={start} className="btn-primary-sm">
                  {t.game.playAgain}
                </button>
                <button type="button" onClick={onClose} className="btn-soft">
                  {t.common.back}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
