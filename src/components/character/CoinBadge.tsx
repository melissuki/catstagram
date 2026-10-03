import { CalendarCheck, Coins, Flame } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'

/** Coin balance plus login and post streaks, shown on the character screens. */
export function CoinBadge() {
  const { currentUser } = useApp()
  const { t } = useTranslation()
  if (!currentUser) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 dark:bg-amber-950/30"
        title={t.shop.balance}
      >
        <Coins className="h-5 w-5 text-amber-500" />
        <span className="font-pixel text-sm text-amber-700 dark:text-amber-300">
          {currentUser.coins}
        </span>
      </div>
      <div
        className="flex items-center gap-1.5 rounded-2xl bg-sky-50 px-3 py-2 text-sm font-bold text-sky-600 dark:bg-sky-950/30 dark:text-sky-300"
        title={t.economy.loginStreak}
      >
        <CalendarCheck className="h-4 w-4" />
        {currentUser.loginStreak}
      </div>
      <div
        className="flex items-center gap-1.5 rounded-2xl bg-orange-50 px-3 py-2 text-sm font-bold text-orange-500 dark:bg-orange-950/30"
        title={t.economy.streak}
      >
        <Flame className="h-4 w-4" />
        {currentUser.postStreak}
      </div>
    </div>
  )
}
