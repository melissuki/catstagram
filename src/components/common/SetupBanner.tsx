import { TriangleAlert } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

export function SetupBanner() {
  const { t } = useTranslation()

  return (
    <div className="animate-fade-up rounded-3xl border border-amber-200/70 bg-gradient-to-r from-purple-50/90 via-pink-50/50 to-orange-50/40 px-4 py-4 text-left shadow-sm">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <p className="font-brand text-base font-bold text-slate-700">
            {t.setup.title}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            {t.setup.body}
          </p>
        </div>
      </div>
    </div>
  )
}
