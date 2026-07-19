import { Cat } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { LanguageToggle } from '@/components/common/LanguageToggle'

export function TopBar() {
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/70 bg-white/65 px-4 py-3 shadow-sm backdrop-blur-xl lg:hidden">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-300/50 to-emerald-300/40 text-teal-600 shadow-sm">
          <Cat className="h-5 w-5" />
        </div>
        <h1 className="font-brand text-lg font-bold text-slate-700">{t.appName}</h1>
      </div>
      <LanguageToggle />
    </header>
  )
}
