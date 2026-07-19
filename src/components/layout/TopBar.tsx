import { Cat } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { LanguageToggle } from '@/components/common/LanguageToggle'

export function TopBar() {
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-cream-deep bg-cream/85 px-4 py-3 backdrop-blur-md lg:hidden">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-peach-light text-peach">
          <Cat className="h-5 w-5" />
        </div>
        <h1 className="font-brand text-lg font-bold text-slate">{t.appName}</h1>
      </div>
      <LanguageToggle />
    </header>
  )
}
