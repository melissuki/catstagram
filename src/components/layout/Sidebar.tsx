import { NavLink } from 'react-router-dom'
import {
  Cat,
  Gamepad2,
  LogOut,
  MessageCircle,
  Home,
  Search,
  UserRound,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { NavNotificationsButton } from '@/components/notifications/NavNotificationsButton'
import { Avatar } from '@/components/common/Avatar'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition duration-300 ${
    isActive
      ? 'nav-active'
      : 'text-slate-500 hover:bg-gradient-to-r hover:from-purple-50/80 hover:via-pink-50/80 hover:to-orange-50/80 hover:text-slate-700 dark:text-slate-400 dark:hover:from-purple-950/40 dark:hover:via-pink-950/30 dark:hover:to-orange-950/20 dark:hover:text-slate-100'
  }`

export function Sidebar() {
  const { currentUser, logout, openGame } = useApp()
  const { t } = useTranslation()

  if (!currentUser) return null

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-purple-100/40 bg-white/55 px-4 py-6 backdrop-blur-xl dark:border-purple-500/20 dark:bg-slate-950/40 lg:flex xl:w-72">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-300/40 via-pink-300/40 to-orange-300/40 text-purple-600 shadow-sm dark:text-pink-300">
          <Cat className="h-6 w-6" />
        </div>
        <div>
          <p className="font-brand text-xl font-bold tracking-tight text-slate-700 dark:text-slate-100">
            {t.appName}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            @{currentUser.username}
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5">
        <NavLink to="/" end className={linkClass}>
          <Home className="h-5 w-5" />
          {t.nav.home}
        </NavLink>
        <NavLink to="/search" className={linkClass}>
          <Search className="h-5 w-5" />
          {t.nav.search}
        </NavLink>
        <NavNotificationsButton variant="sidebar" />
        <button
          type="button"
          onClick={openGame}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-500 transition duration-300 hover:bg-gradient-to-r hover:from-purple-50/80 hover:via-pink-50/80 hover:to-orange-50/80 hover:text-slate-700 dark:text-slate-400 dark:hover:from-purple-950/40 dark:hover:via-pink-950/30 dark:hover:to-orange-950/20 dark:hover:text-slate-100"
        >
          <Gamepad2 className="h-5 w-5 text-pink-500" />
          {t.game.play}
        </button>
        <NavLink to="/messages" className={linkClass}>
          <MessageCircle className="h-5 w-5" />
          {t.nav.messages}
        </NavLink>
        <NavLink to="/profile" className={linkClass}>
          <UserRound className="h-5 w-5" />
          {t.nav.profile}
        </NavLink>
      </nav>

      <div className="mt-6 space-y-3 border-t border-purple-100/40 pt-4 dark:border-purple-500/20">
        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <LanguageToggle />
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-purple-100/40 bg-white/70 px-3 py-3 shadow-sm dark:border-purple-500/20 dark:bg-slate-900/70">
          <Avatar src={currentUser.avatar} alt={currentUser.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-700 dark:text-slate-100">
              {currentUser.name}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              @{currentUser.username}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-white/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-900/70 dark:hover:text-slate-100"
        >
          <LogOut className="h-4 w-4" />
          {t.nav.logout}
        </button>
      </div>
    </aside>
  )
}
