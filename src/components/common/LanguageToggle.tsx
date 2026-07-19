import { Languages } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

export function LanguageToggle() {
  const { language, setLanguage, t } = useTranslation()

  return (
    <button
      type="button"
      onClick={() => setLanguage(language === 'en' ? 'tr' : 'en')}
      className="btn-soft"
      aria-label={t.common.language}
    >
      <Languages className="h-4 w-4 text-pink-500" />
      <span className="text-xs">{language === 'en' ? t.common.turkish : t.common.english}</span>
    </button>
  )
}
