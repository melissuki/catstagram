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
      className={`animate-fade-up overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-white/90 via-teal-50/40 to-emerald-50/50 shadow-sm backdrop-blur-md ${
        compact ? 'p-4' : 'p-5 sm:p-6'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-brand text-lg font-bold text-slate-700 sm:text-xl">
            {t.dashboard.title}
          </p>
          {!compact ? (
            <p className="mt-1 text-sm text-slate-500">{t.dashboard.subtitle}</p>
          ) : null}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-100 to-emerald-100 text-teal-600 shadow-sm">
          <Flame className="h-5 w-5" />
        </div>
      </div>

      <div
        className={`mt-4 flex items-center gap-2 rounded-2xl border border-white/80 bg-white/75 px-4 py-3 shadow-sm ${
          streak.fedToday ? 'animate-streak-pop' : ''
        }`}
      >
        <span className="font-brand bg-gradient-to-r from-teal-500 to-emerald-500 bg-clip-text text-3xl font-bold text-transparent">
          {streak.count}
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-700">
            {t.dashboard.streakLabel} 🔥
          </p>
          <p className="text-xs text-slate-500">
            {streak.fedToday ? t.dashboard.fedToday : t.dashboard.comeBack}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={feedCat}
        disabled={streak.fedToday}
        className={`mt-4 w-full ${
          streak.fedToday
            ? 'cursor-not-allowed rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-400'
            : 'btn-primary animate-soft-pulse'
        }`}
      >
        <PawPrint className="h-4 w-4" />
        {streak.fedToday ? t.dashboard.fedToday : t.dashboard.feedButton}
      </button>

      {compact ? (
        <Link
          to="/dashboard"
          className="mt-3 block text-center text-xs font-semibold text-teal-600 transition hover:text-emerald-600"
        >
          {t.nav.dashboard} →
        </Link>
      ) : null}
    </section>
  )
}
