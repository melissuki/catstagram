import { useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import {
  dismissPrompt,
  getDesktopPermission,
  isPromptDismissed,
  requestDesktopPermission,
  type DesktopPermission,
} from '@/utils/desktopNotifications'

/**
 * Asks signed-in users to allow computer notifications. With `variant="row"`
 * it renders a status row for the notifications drawer instead of a banner.
 */
export function DesktopNotificationPrompt({ variant = 'banner' }: { variant?: 'banner' | 'row' }) {
  const { currentUser } = useApp()
  const { t } = useTranslation()
  const [permission, setPermission] = useState<DesktopPermission>(getDesktopPermission)
  const [dismissed, setDismissed] = useState(isPromptDismissed)

  if (!currentUser || permission === 'unsupported') return null

  const enable = async () => {
    setPermission(await requestDesktopPermission())
  }

  if (variant === 'row') {
    return (
      <div className="mx-4 mb-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-purple-50 via-pink-50 to-orange-50 px-3 py-2.5 text-xs dark:from-purple-950/40 dark:via-pink-950/30 dark:to-orange-950/20">
        <BellRing className="h-4 w-4 shrink-0 text-pink-500" />
        <p className="flex-1 text-slate-600 dark:text-slate-300">
          {permission === 'granted'
            ? t.notifications.desktopOn
            : permission === 'denied'
              ? t.notifications.desktopBlocked
              : t.notifications.desktopPrompt}
        </p>
        {permission === 'default' ? (
          <button type="button" onClick={() => void enable()} className="btn-primary-sm shrink-0">
            {t.notifications.desktopEnable}
          </button>
        ) : null}
      </div>
    )
  }

  if (permission !== 'default' || dismissed) return null

  return (
    <div className="card-panel animate-fade-up mx-auto mb-4 flex max-w-3xl items-center gap-3 p-3 sm:p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-pink-50 text-pink-500 dark:bg-pink-950/30">
        <BellRing className="h-5 w-5" />
      </span>
      <p className="flex-1 text-sm text-slate-600 dark:text-slate-300">{t.notifications.desktopPrompt}</p>
      <button type="button" onClick={() => void enable()} className="btn-primary-sm shrink-0">
        {t.notifications.desktopEnable}
      </button>
      <button
        type="button"
        onClick={() => {
          dismissPrompt()
          setDismissed(true)
        }}
        className="shrink-0 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        aria-label={t.notifications.desktopLater}
        title={t.notifications.desktopLater}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
