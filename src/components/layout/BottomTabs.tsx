import { NavLink } from 'react-router-dom'
import {
  Home,
  LayoutDashboard,
  MessageCircle,
  UserRound,
} from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold transition ${
    isActive ? 'text-peach' : 'text-slate-muted'
  }`

export function BottomTabs() {
  const { t } = useTranslation()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-deep bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-lg items-center">
        <NavLink to="/" end className={tabClass}>
          <Home className="h-5 w-5" />
          {t.nav.home}
        </NavLink>
        <NavLink to="/messages" className={tabClass}>
          <MessageCircle className="h-5 w-5" />
          {t.nav.messages}
        </NavLink>
        <NavLink to="/dashboard" className={tabClass}>
          <LayoutDashboard className="h-5 w-5" />
          {t.nav.dashboard}
        </NavLink>
        <NavLink to="/profile" className={tabClass}>
          <UserRound className="h-5 w-5" />
          {t.nav.profile}
        </NavLink>
      </div>
    </nav>
  )
}
