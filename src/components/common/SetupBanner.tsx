import { TriangleAlert } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

export function SetupBanner() {
  const { t } = useTranslation()

  return (
    <div className="animate-fade-up rounded-[1.5rem] border border-peach/40 bg-peach-light/80 px-4 py-4 text-left">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-peach" />
        <div>
          <p className="font-brand text-base font-bold text-slate">
            {t.setup.title}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-muted">
            {t.setup.body}
          </p>
        </div>
      </div>
    </div>
  )
}
