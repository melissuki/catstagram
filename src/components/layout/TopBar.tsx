import { Link } from 'react-router-dom'
import { Cat, MessageCircle } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { ThemeToggle } from '@/components/common/ThemeToggle'

export function TopBar() {
  const { t } = useTranslation()
  const { requireAuth, openAuthModal, isAuthenticated } = useApp()

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-purple-100/40 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl dark:border-purple-500/20 dark:bg-slate-950/70 lg:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-300/50 via-pink-300/40 to-orange-300/40 text-purple-600 shadow-sm dark:text-pink-300">
          <Cat className="h-5 w-5" />
        </div>
        <h1 className="font-brand truncate text-lg font-bold text-slate-700 dark:text-slate-100">
          {t.appName}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {!isAuthenticated ? (
          <button
            type="button"
            onClick={openAuthModal}
            className="btn-primary-sm px-2.5 text-[11px]"
          >
            {t.auth.joinCta}
          </button>
        ) : null}
        <Link
          to="/messages"
          onClick={(event) => {
            if (!requireAuth()) event.preventDefault()
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-purple-100/50 bg-white/80 text-purple-600 shadow-sm transition hover:bg-pink-50 dark:border-purple-500/20 dark:bg-slate-900/80 dark:text-pink-300"
          aria-label={t.nav.messages}
        >
          <MessageCircle className="h-4 w-4" />
        </Link>
        <ThemeToggle />
        <LanguageToggle />
      </div>
    </header>
  )
}
