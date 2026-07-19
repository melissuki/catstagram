import { Languages } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

export function LanguageToggle() {
  const { language, setLanguage, t } = useTranslation()

  return (
    <button
      type="button"
      onClick={() => setLanguage(language === 'en' ? 'tr' : 'en')}
      className="inline-flex items-center gap-2 rounded-2xl bg-peach-light/70 px-3 py-2 text-xs font-semibold text-slate transition hover:bg-peach-soft"
      aria-label={t.common.language}
    >
      <Languages className="h-4 w-4 text-peach" />
      {language === 'en' ? t.common.turkish : t.common.english}
    </button>
  )
}
