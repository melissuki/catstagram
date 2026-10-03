import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Check, RotateCcw, ShoppingBag } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { CatCharacter } from '@/components/character/CatCharacter'
import { CoinBadge } from '@/components/character/CoinBadge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import {
  CHARACTER_SLOTS,
  REQUIRED_SLOTS,
  sameCharacter,
  type CharacterConfig,
  type CharacterSlot,
} from '@/character/catalog'
import { toUserFacingError } from '@/utils/userFacingError'
import * as api from '@/services/api'
import type { ShopItem } from '@/types/shop'

export function CharacterPage() {
  const { currentUser, equipCharacter } = useApp()
  const { t } = useTranslation()
  const userId = currentUser?.id ?? null
  const saved = currentUser?.avatarConfig ?? null

  const [draft, setDraft] = useState<CharacterConfig | null>(saved)
  const [slot, setSlot] = useState<CharacterSlot>('fur')
  const [items, setItems] = useState<ShopItem[]>([])
  const [ownedKeys, setOwnedKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Start from the saved look once the profile is available
  useEffect(() => {
    if (saved && !draft) setDraft(saved)
  }, [saved, draft])

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
        console.error('[character]', error)
        if (!cancelled) toast.error(toUserFacingError(error, t.shop.loadFailed))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, t.shop.loadFailed])

  const available = useMemo(
    () => items.filter((item) => item.price === 0 || ownedKeys.has(item.key)),
    [items, ownedKeys],
  )
  const slotItems = available.filter((item) => item.slot === slot)
  const lockedCount = items.length - available.length

  if (!currentUser || !draft || !saved) return null

  const dirty = !sameCharacter(draft, saved)
  const optional = !REQUIRED_SLOTS.includes(slot)

  const choose = (key: string | null) => {
    setDraft((prev) => (prev ? { ...prev, [slot]: key } : prev))
  }

  const save = async () => {
    setSaving(true)
    try {
      await equipCharacter(draft)
      toast.success(t.character.saved)
    } catch (error) {
      console.error('[character] save failed', error)
      toast.error(toUserFacingError(error, t.character.saveFailed))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h2 className="font-brand text-2xl font-bold text-slate-700 dark:text-slate-100">
            {t.character.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.character.subtitle}</p>
        </div>
        <CoinBadge />
      </section>

      <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <section className="card-panel animate-fade-up space-y-3 p-4">
          <div className="overflow-hidden rounded-3xl shadow-inner">
            <CatCharacter config={draft} className="block aspect-square w-full" title={currentUser.name} />
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="btn-primary w-full"
          >
            <Check className="h-4 w-4" />
            {saving ? t.common.loading : t.character.save}
          </button>
          {dirty ? (
            <button type="button" onClick={() => setDraft(saved)} className="btn-soft w-full">
              <RotateCcw className="h-4 w-4" />
              {t.character.reset}
            </button>
          ) : null}
        </section>

        <section className="card-panel animate-fade-up space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            {CHARACTER_SLOTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSlot(value)}
                className={
                  value === slot
                    ? 'nav-active rounded-2xl px-3 py-1.5 text-sm font-semibold'
                    : 'btn-soft py-1.5'
                }
              >
                {t.character.slots[value]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <LoadingSpinner />
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {optional ? (
                <li>
                  <ItemTile
                    selected={draft[slot] === null}
                    label={t.character.none}
                    onClick={() => choose(null)}
                  >
                    <CatCharacter config={{ ...draft, [slot]: null }} className="h-full w-full" />
                  </ItemTile>
                </li>
              ) : null}
              {slotItems.map((item) => (
                <li key={item.id}>
                  <ItemTile selected={draft[slot] === item.key} onClick={() => choose(item.key)}>
                    <CatCharacter config={{ ...draft, [slot]: item.key }} className="h-full w-full" />
                  </ItemTile>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-purple-50 via-pink-50 to-orange-50 px-4 py-3 dark:from-purple-950/40 dark:via-pink-950/30 dark:to-orange-950/20">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {lockedCount > 0 ? t.character.lockedHint : t.shop.earnHint}
            </p>
            <Link to="/market" className="btn-primary-sm">
              <ShoppingBag className="h-4 w-4" />
              {t.character.goToMarket}
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

function ItemTile({
  selected,
  label,
  onClick,
  children,
}: {
  selected: boolean
  label?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative block aspect-square w-full overflow-hidden rounded-2xl border-2 transition duration-200 hover:-translate-y-0.5 ${
        selected
          ? 'border-pink-400 shadow-md'
          : 'border-transparent opacity-90 hover:opacity-100'
      }`}
    >
      {children}
      {label ? (
        <span className="absolute inset-x-0 bottom-0 bg-white/80 py-0.5 text-center text-[11px] font-bold text-slate-600 dark:bg-slate-900/80 dark:text-slate-200">
          {label}
        </span>
      ) : null}
      {selected ? (
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white">
          <Check className="h-3 w-3" />
        </span>
      ) : null}
    </button>
  )
}
