import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Check, Coins, Lock, Shirt } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { CatCharacter } from '@/components/character/CatCharacter'
import { CoinBadge } from '@/components/character/CoinBadge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { CHARACTER_SLOTS, itemName, type CharacterSlot } from '@/character/catalog'
import { toUserFacingError } from '@/utils/userFacingError'
import * as api from '@/services/api'
import type { ShopItem } from '@/types/shop'

type Filter = CharacterSlot | 'all'

export function MarketPage() {
  const { currentUser, refreshCurrentUser, equipCharacter } = useApp()
  const { t, language } = useTranslation()
  const userId = currentUser?.id ?? null

  const [items, setItems] = useState<ShopItem[]>([])
  const [ownedKeys, setOwnedKeys] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      try {
        const [catalog, inventory] = await Promise.all([
          api.fetchShopItems(),
          api.fetchMyInventory(userId),
        ])
        if (cancelled) return
        setItems(catalog)
        setOwnedKeys(new Set(inventory.map((entry) => entry.itemKey)))
      } catch (error) {
        console.error('[market]', error)
        if (!cancelled) toast.error(toUserFacingError(error, t.shop.loadFailed))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, t.shop.loadFailed])

  // Paid items first (that's what the market is for), then by price
  const visible = useMemo(
    () =>
      items
        .filter((item) => filter === 'all' || item.slot === filter)
        .sort((a, b) => Number(a.price === 0) - Number(b.price === 0) || a.price - b.price),
    [items, filter],
  )

  if (!currentUser) return null
  const look = currentUser.avatarConfig

  const buy = async (item: ShopItem) => {
    if (busyKey || currentUser.coins < item.price) return
    setBusyKey(item.key)
    try {
      // Coin check, debit and inventory insert all happen server-side.
      await api.purchaseItem(item.key)
      setOwnedKeys((prev) => new Set(prev).add(item.key))
      await refreshCurrentUser()
      toast.success(t.shop.bought.replace('{item}', itemName(item.key, language)))
    } catch (error) {
      console.error('[market] purchase failed', error)
      const message = error instanceof Error ? error.message.toLowerCase() : ''
      if (message.includes('not enough coins')) {
        toast.error(t.shop.notEnough)
      } else if (message.includes('already owned')) {
        setOwnedKeys((prev) => new Set(prev).add(item.key))
      } else {
        toast.error(toUserFacingError(error, t.shop.buyFailed))
      }
      void refreshCurrentUser().catch(() => undefined)
    } finally {
      setBusyKey(null)
    }
  }

  const wear = async (item: ShopItem) => {
    if (busyKey) return
    setBusyKey(item.key)
    try {
      await equipCharacter({ ...look, [item.slot]: item.key })
      toast.success(t.character.saved)
    } catch (error) {
      console.error('[market] equip failed', error)
      toast.error(toUserFacingError(error, t.character.saveFailed))
    } finally {
      setBusyKey(null)
    }
  }

  const filters: Filter[] = ['all', ...CHARACTER_SLOTS]

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h2 className="font-brand text-2xl font-bold text-slate-700 dark:text-slate-100">
            {t.shop.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.shop.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CoinBadge />
          <Link to="/character" className="btn-soft">
            <Shirt className="h-4 w-4" />
            {t.nav.character}
          </Link>
        </div>
      </section>

      <p className="px-1 text-xs text-slate-500 dark:text-slate-400">{t.shop.earnHint}</p>

      <div className="flex flex-wrap gap-2 px-1">
        {filters.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={
              value === filter
                ? 'nav-active rounded-2xl px-3 py-1.5 text-sm font-semibold'
                : 'btn-soft py-1.5'
            }
          >
            {value === 'all' ? t.shop.all : t.character.slots[value]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : visible.length === 0 ? (
        <p className="card-panel p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {t.shop.empty}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visible.map((item) => {
            const owned = item.price === 0 || ownedKeys.has(item.key)
            const wearing = look[item.slot] === item.key
            const affordable = currentUser.coins >= item.price
            const busy = busyKey === item.key
            const name = itemName(item.key, language)
            return (
              <li key={item.id} className="card-panel animate-fade-up flex flex-col gap-2 p-3">
                <div className="overflow-hidden rounded-2xl">
                  {/* Try-on preview: the user's current look wearing this item */}
                  <CatCharacter
                    config={{ ...look, [item.slot]: item.key }}
                    className="block aspect-square w-full"
                    title={name}
                  />
                </div>
                <p className="truncate text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {name}
                </p>
                {wearing ? (
                  <span className="inline-flex items-center justify-center gap-1 rounded-xl bg-pink-50 px-3 py-1.5 text-xs font-bold text-pink-500 dark:bg-pink-950/30">
                    <Check className="h-3.5 w-3.5" />
                    {t.shop.wearing}
                  </span>
                ) : owned ? (
                  <button
                    type="button"
                    onClick={() => void wear(item)}
                    disabled={busyKey !== null}
                    className="btn-soft py-1.5 text-xs"
                  >
                    <Shirt className="h-3.5 w-3.5" />
                    {busy ? t.common.loading : t.shop.wear}
                    {item.price === 0 ? (
                      <span className="text-[10px] font-semibold text-emerald-500">
                        · {t.shop.free}
                      </span>
                    ) : null}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void buy(item)}
                    disabled={!affordable || busyKey !== null}
                    className="btn-primary-sm w-full"
                    title={affordable ? t.shop.buy : t.shop.notEnough}
                  >
                    {affordable ? <Coins className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {busy ? t.common.loading : `${t.shop.buy} · ${item.price}`}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
