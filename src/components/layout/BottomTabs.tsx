import { NavLink } from 'react-router-dom'
import { Gamepad2, Home, Search, UserRound } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { NavNotificationsButton } from '@/components/notifications/NavNotificationsButton'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold transition duration-300 ${
    isActive
      ? 'bg-gradient-to-t from-purple-50/80 to-transparent text-purple-600 dark:from-purple-950/50 dark:text-pink-300'
      : 'text-slate-500 dark:text-slate-400'
  }`

export function BottomTabs() {
  const { t } = useTranslation()
  const { openGame, requireAuth } = useApp()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-purple-100/40 bg-white/85 px-1 pb-[env(safe-area-inset-bottom)] pt-1 shadow-sm backdrop-blur-xl dark:border-purple-500/20 dark:bg-slate-950/85 lg:hidden">
      <div className="mx-auto flex max-w-lg items-center">
        <NavLink to="/" end className={tabClass}>
          <Home className="h-5 w-5" />
          {t.nav.home}
        </NavLink>
        <NavLink to="/search" className={tabClass}>
          <Search className="h-5 w-5" />
          {t.nav.search}
        </NavLink>
        <NavNotificationsButton variant="tab" />
        <button
          type="button"
          onClick={openGame}
          className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold text-pink-500 transition duration-300"
        >
          <Gamepad2 className="h-5 w-5" />
          {t.nav.play}
        </button>
        <NavLink
          to="/profile"
          className={tabClass}
          onClick={(event) => {
            if (!requireAuth()) event.preventDefault()
          }}
        >
          <UserRound className="h-5 w-5" />
          {t.nav.profile}
        </NavLink>
      </div>
    </nav>
  )
}
