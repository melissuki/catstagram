import { NavLink } from 'react-router-dom'
import {
  Home,
  LayoutDashboard,
  MessageCircle,
  UserRound,
} from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold transition duration-300 ${
    isActive
      ? 'bg-gradient-to-t from-purple-50/80 to-transparent text-purple-600'
      : 'text-slate-500'
  }`

export function BottomTabs() {
  const { t } = useTranslation()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-purple-100/40 bg-white/85 px-2 pb-[env(safe-area-inset-bottom)] pt-1 shadow-sm backdrop-blur-xl lg:hidden">
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
