import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { useTranslation } from '@/hooks/useTranslation'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="btn-soft"
      aria-label={t.theme.toggle}
      title={theme === 'dark' ? t.theme.light : t.theme.dark}
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4 text-orange-300" />
      ) : (
        <Moon className="h-4 w-4 text-purple-500" />
      )}
      <span className="text-xs">
        {theme === 'dark' ? t.theme.light : t.theme.dark}
      </span>
    </button>
  )
}
