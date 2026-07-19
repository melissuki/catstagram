import { useApp } from '@/context/AppContext'
import { getTranslations } from '@/i18n/translations'

export function useTranslation() {
  const { language, setLanguage } = useApp()
  const t = getTranslations(language)

  return { t, language, setLanguage }
}
