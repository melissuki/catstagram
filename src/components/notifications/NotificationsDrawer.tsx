import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, X } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { Avatar } from '@/components/common/Avatar'
import { formatRelativeTime } from '@/utils/relativeTime'
import { profilePath } from '@/utils/username'
import type { AppNotification } from '@/types'

function actionLine(
  item: AppNotification,
  t: ReturnType<typeof useTranslation>['t'],
) {
  if (item.type === 'like') return t.notifications.liked
  if (item.type === 'follow') return t.notifications.followed
  if (item.type === 'comment') {
    return item.body.trim()
      ? `${t.notifications.commented} “${item.body.trim()}”`
      : t.notifications.commented
  }
  return item.body.trim()
    ? `${t.notifications.messaged} “${item.body.trim()}”`
    : t.notifications.messaged
}

export function NotificationsDrawer() {
  const {
    notificationsOpen,
    closeNotifications,
    notifications,
    markNotificationsAsRead,
    language,
    startChatWith,
  } = useApp()
  const { t } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!notificationsOpen) return
    void markNotificationsAsRead()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeNotifications()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [notificationsOpen, markNotificationsAsRead, closeNotifications])

  const openItem = async (item: AppNotification) => {
    closeNotifications()
    if (item.type === 'message') {
      await startChatWith(item.actorId)
      navigate('/messages')
      return
    }
    navigate(profilePath(item.actorId))
  }

  return (
    <div
      className={`fixed inset-0 z-[70] transition ${
        notificationsOpen ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      aria-hidden={!notificationsOpen}
    >
      <button
        type="button"
        aria-label={t.common.back}
        onClick={closeNotifications}
        className={`absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] transition-opacity duration-300 ${
          notificationsOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t.notifications.title}
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-purple-100/50 bg-gradient-to-b from-white via-pink-50/30 to-orange-50/20 shadow-[-12px_0_40px_-20px_rgba(168,85,247,0.35)] transition-transform duration-300 ease-out dark:border-purple-500/25 dark:from-slate-950 dark:via-purple-950/40 dark:to-slate-900 dark:shadow-[-12px_0_40px_-16px_rgba(168,85,247,0.45)] ${
          notificationsOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-purple-100/40 bg-gradient-to-r from-purple-50 via-pink-50/80 to-orange-50/60 px-4 py-4 dark:border-purple-500/20 dark:from-slate-950 dark:via-purple-950/50 dark:to-slate-900">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-300/50 via-pink-300/40 to-orange-300/40 text-pink-500">
              <Heart className="h-4 w-4 fill-pink-400/40" />
            </span>
            <div>
              <p className="font-brand text-base font-bold text-slate-700 dark:text-slate-100">
                {t.notifications.title}
              </p>
              <p className="text-[11px] font-semibold text-slate-400">
                {t.notifications.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeNotifications}
            className="rounded-full bg-white/70 p-2 text-slate-500 transition hover:text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            aria-label={t.common.back}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <ul className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          {notifications.length === 0 ? (
            <li className="px-6 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
              {t.notifications.empty}
            </li>
          ) : (
            notifications.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void openItem(item)}
                  className={`flex w-full gap-3 px-4 py-3.5 text-left transition hover:bg-pink-50/70 dark:hover:bg-purple-950/35 ${
                    item.isRead
                      ? ''
                      : 'bg-purple-50/50 dark:bg-purple-950/25'
                  }`}
                >
                  <Avatar
                    src={item.actorAvatar}
                    alt={item.actorName}
                    size="md"
                    ring={!item.isRead}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-slate-700 dark:text-slate-200">
                      <span className="font-bold text-pink-500">
                        @{item.actorUsername}
                      </span>{' '}
                      {actionLine(item, t)}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      {formatRelativeTime(item.createdAt, language)}
                      {item.type === 'message' ? (
                        <span className="ml-2 rounded-md bg-gradient-to-r from-purple-100 via-pink-100 to-orange-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-600 dark:from-purple-950/50 dark:via-pink-950/40 dark:to-orange-950/30 dark:text-pink-300">
                          DM
                        </span>
                      ) : null}
                    </p>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>
    </div>
  )
}
