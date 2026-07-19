import { Heart } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'

type Variant = 'sidebar' | 'tab'

interface NavNotificationsButtonProps {
  variant: Variant
}

export function NavNotificationsButton({ variant }: NavNotificationsButtonProps) {
  const { openNotifications, unreadNotificationCount, notificationsOpen } =
    useApp()
  const { t } = useTranslation()

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={openNotifications}
        aria-expanded={notificationsOpen}
        aria-label={t.notifications.title}
        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition duration-300 ${
          notificationsOpen
            ? 'nav-active'
            : 'text-slate-500 hover:bg-gradient-to-r hover:from-purple-50/80 hover:via-pink-50/80 hover:to-orange-50/80 hover:text-slate-700 dark:text-slate-400 dark:hover:from-purple-950/40 dark:hover:via-pink-950/30 dark:hover:to-orange-950/20 dark:hover:text-slate-100'
        }`}
      >
        <span className="relative">
          <Heart
            className={`h-5 w-5 ${
              notificationsOpen || unreadNotificationCount > 0
                ? 'fill-pink-400/35 text-pink-500'
                : ''
            }`}
          />
          {unreadNotificationCount > 0 ? (
            <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm">
              {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
            </span>
          ) : null}
        </span>
        {t.nav.notifications}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={openNotifications}
      aria-expanded={notificationsOpen}
      aria-label={t.notifications.title}
      className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold transition duration-300 ${
        notificationsOpen
          ? 'bg-gradient-to-t from-pink-50/90 to-transparent text-pink-500 dark:from-purple-950/50 dark:text-pink-300'
          : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      <span className="relative">
        <Heart
          className={`h-5 w-5 ${
            unreadNotificationCount > 0 ? 'fill-pink-400/40 text-pink-500' : ''
          }`}
        />
        {unreadNotificationCount > 0 ? (
          <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm">
            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
          </span>
        ) : null}
      </span>
      {t.nav.notifications}
    </button>
  )
}
