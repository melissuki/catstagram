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
  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
    isActive
      ? 'bg-peach text-white shadow-[0_8px_20px_-10px_rgba(244,162,97,0.9)]'
      : 'text-slate-muted hover:bg-peach-light/70 hover:text-slate'
  }`

export function Sidebar() {
  const { currentUser, logout } = useApp()
  const { t } = useTranslation()

  if (!currentUser) return null

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-cream-deep bg-surface/70 px-4 py-6 backdrop-blur-md lg:flex xl:w-72">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-peach-light text-peach">
          <Cat className="h-6 w-6" />
        </div>
        <div>
          <p className="font-brand text-xl font-bold tracking-tight text-slate">
            {t.appName}
          </p>
          <p className="text-xs text-slate-muted">soft social for cats</p>
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

      <div className="mt-6 space-y-3 border-t border-cream-deep pt-4">
        <LanguageToggle />
        <div className="flex items-center gap-3 rounded-2xl bg-cream-soft px-3 py-3">
          <Avatar src={currentUser.avatar} alt={currentUser.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate">
              {currentUser.name}
            </p>
            <p className="truncate text-xs text-slate-muted">{currentUser.breed}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-muted transition hover:bg-cream-deep hover:text-slate"
        >
          <LogOut className="h-4 w-4" />
          {t.nav.logout}
        </button>
      </div>
    </aside>
  )
}
