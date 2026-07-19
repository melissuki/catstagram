import { CalendarHeart } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { MamaStreakWidget } from '@/components/streak/MamaStreakWidget'

export function DashboardPage() {
  const { streak } = useApp()
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="animate-fade-up px-1">
        <h2 className="font-brand text-2xl font-bold text-slate-700 sm:text-3xl">
          {t.dashboard.title}
        </h2>
        <p className="mt-1 text-sm text-slate-500 sm:text-base">
          {t.dashboard.subtitle}
        </p>
      </header>

      <MamaStreakWidget />

      <section className="card-panel animate-fade-up p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-100 to-emerald-100 text-teal-600">
            <CalendarHeart className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-brand text-lg font-bold text-slate-700">
              {t.dashboard.history}
            </h3>
            <p className="text-sm text-slate-500">{t.dashboard.tip}</p>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/80 bg-gradient-to-br from-teal-50/50 to-emerald-50/40 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.dashboard.streakLabel}
            </dt>
            <dd className="mt-1 font-brand text-2xl font-bold text-teal-600">
              {streak.count} 🔥
            </dd>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.dashboard.lastFed}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-700">
              {streak.lastFedDate
                ? new Date(streak.lastFedDate).toLocaleDateString()
                : t.dashboard.neverFed}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
