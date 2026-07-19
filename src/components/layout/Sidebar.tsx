import { NavLink } from 'react-router-dom'
import {
  Cat,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Home,
  UserRound,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { Avatar } from '@/components/common/Avatar'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition duration-300 ${
    isActive
      ? 'nav-active'
      : 'text-slate-500 hover:bg-gradient-to-r hover:from-purple-50/80 hover:via-pink-50/80 hover:to-orange-50/80 hover:text-slate-700'
  }`

export function Sidebar() {
  const { currentUser, logout } = useApp()
  const { t } = useTranslation()

  if (!currentUser) return null

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-purple-100/40 bg-white/55 px-4 py-6 backdrop-blur-xl lg:flex xl:w-72">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-300/40 via-pink-300/40 to-orange-300/40 text-purple-600 shadow-sm">
          <Cat className="h-6 w-6" />
        </div>
        <div>
          <p className="font-brand text-xl font-bold tracking-tight text-slate-700">
            {t.appName}
          </p>
          <p className="text-xs text-slate-500">soft social for cats</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5">
        <NavLink to="/" end className={linkClass}>
          <Home className="h-5 w-5" />
          {t.nav.home}
        </NavLink>
        <NavLink to="/messages" className={linkClass}>
          <MessageCircle className="h-5 w-5" />
          {t.nav.messages}
        </NavLink>
        <NavLink to="/dashboard" className={linkClass}>
          <LayoutDashboard className="h-5 w-5" />
          {t.nav.dashboard}
        </NavLink>
        <NavLink to="/profile" className={linkClass}>
          <UserRound className="h-5 w-5" />
          {t.nav.profile}
        </NavLink>
      </nav>

      <div className="mt-6 space-y-3 border-t border-white/70 pt-4">
        <LanguageToggle />
        <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/70 px-3 py-3 shadow-sm">
          <Avatar src={currentUser.avatar} alt={currentUser.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-700">
              {currentUser.name}
            </p>
            <p className="truncate text-xs text-slate-500">{currentUser.breed}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-white/70 hover:text-slate-700"
        >
          <LogOut className="h-4 w-4" />
          {t.nav.logout}
        </button>
      </div>
    </aside>
  )
}
