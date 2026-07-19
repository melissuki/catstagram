import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Story } from '@/types'
import { Avatar } from '@/components/common/Avatar'

const STORY_DURATION_MS = 5000

interface StoryViewerProps {
  stories: Story[]
  startIndex?: number
  onClose: () => void
  onComplete: (viewedIds: string[]) => void
}

export function StoryViewer({
  stories,
  startIndex = 0,
  onClose,
  onComplete,
}: StoryViewerProps) {
  const [index, setIndex] = useState(startIndex)
  const [progress, setProgress] = useState(0)
  const viewedRef = useRef<Set<string>>(new Set())
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(0)
  const onCloseRef = useRef(onClose)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCloseRef.current = onClose
    onCompleteRef.current = onComplete
  }, [onClose, onComplete])

  const current = stories[index]

  useEffect(() => {
    if (!current) {
      onCloseRef.current()
      return
    }

    viewedRef.current.add(current.id)
    setProgress(0)
    startRef.current = performance.now()

    let cancelled = false

    const tick = (now: number) => {
      if (cancelled) return
      const elapsed = now - startRef.current
      const pct = Math.min(100, (elapsed / STORY_DURATION_MS) * 100)
      setProgress(pct)

      if (elapsed >= STORY_DURATION_MS) {
        setIndex((prev) => {
          if (prev < stories.length - 1) return prev + 1
          onCompleteRef.current([...viewedRef.current])
          onCloseRef.current()
          return prev
        })
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [current, stories.length])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCompleteRef.current([...viewedRef.current])
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!current) return null

  const finish = () => {
    onCompleteRef.current([...viewedRef.current])
    onCloseRef.current()
  }

  const advance = () => {
    if (index < stories.length - 1) setIndex((prev) => prev + 1)
    else finish()
  }

  const goBack = () => {
    if (index > 0) setIndex((prev) => prev - 1)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${current.authorName} story`}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-purple-500/25 bg-slate-950 shadow-[0_25px_80px_-20px_rgba(168,85,247,0.45)]">
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-3 pt-3">
          {stories.map((story, i) => (
            <div
              key={story.id}
              className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-300 via-pink-300 to-orange-300 transition-[width] duration-75 ease-linear"
                style={{
                  width:
                    i < index ? '100%' : i === index ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        <div className="absolute inset-x-0 top-5 z-20 flex items-center justify-between px-4 pt-3">
          <div className="flex items-center gap-2">
            <Avatar
              src={current.authorAvatar}
              alt={current.authorName}
              size="sm"
              ring
            />
            <div>
              <p className="text-sm font-bold text-white">{current.authorName}</p>
              <p className="text-[11px] font-semibold text-pink-200/90">
                @{current.authorUsername}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={finish}
            className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-pointer"
          aria-label="Previous"
          onClick={goBack}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 z-10 w-1/3 cursor-pointer"
          aria-label="Next"
          onClick={advance}
        />

        <img
          src={current.mediaUrl}
          alt=""
          className="aspect-[9/16] max-h-[min(80dvh,720px)] w-full object-cover"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/55 via-transparent to-slate-950/40" />
      </div>
    </div>
  )
}
