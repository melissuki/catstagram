import { Flame, PawPrint } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'

interface MamaStreakWidgetProps {
  compact?: boolean
}

export function MamaStreakWidget({ compact = false }: MamaStreakWidgetProps) {
  const { streak, feedCat } = useApp()
  const { t } = useTranslation()

  return (
    <section
      className={`animate-fade-up overflow-hidden rounded-[1.75rem] border border-peach-soft/60 bg-gradient-to-br from-surface via-peach-light/50 to-peach-soft/40 ${
        compact ? 'p-4' : 'p-5 sm:p-6'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-brand text-lg font-bold text-slate sm:text-xl">
            {t.dashboard.title}
          </p>
          {!compact ? (
            <p className="mt-1 text-sm text-slate-muted">{t.dashboard.subtitle}</p>
          ) : null}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface/80 text-streak">
          <Flame className="h-5 w-5" />
        </div>
      </div>

      <div
        className={`mt-4 flex items-center gap-2 rounded-2xl bg-surface/70 px-4 py-3 ${
          streak.fedToday ? 'animate-streak-pop' : ''
        }`}
      >
        <span className="font-brand text-3xl font-bold text-streak">
          {streak.count}
        </span>
        <div>
          <p className="text-sm font-semibold text-slate">
            {t.dashboard.streakLabel} 🔥
          </p>
          <p className="text-xs text-slate-muted">
            {streak.fedToday ? t.dashboard.fedToday : t.dashboard.comeBack}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={feedCat}
        disabled={streak.fedToday}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${
          streak.fedToday
            ? 'cursor-not-allowed bg-cream-deep text-slate-muted'
            : 'animate-soft-pulse bg-peach text-white hover:bg-coral'
        }`}
      >
        <PawPrint className="h-4 w-4" />
        {streak.fedToday ? t.dashboard.fedToday : t.dashboard.feedButton}
      </button>

      {compact ? (
        <Link
          to="/dashboard"
          className="mt-3 block text-center text-xs font-semibold text-peach hover:text-coral"
        >
          {t.nav.dashboard} →
        </Link>
      ) : null}
    </section>
  )
}
