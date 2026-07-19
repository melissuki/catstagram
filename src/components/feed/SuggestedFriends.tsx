import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CatProfile } from '@/types'
import { fetchSuggestedCats } from '@/services/api'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { Avatar } from '@/components/common/Avatar'

export function SuggestedFriends() {
  const { currentUser, followingIds, toggleFollow, startChatWith } = useApp()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [cats, setCats] = useState<CatProfile[]>([])

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false

    const load = async () => {
      try {
        const data = await fetchSuggestedCats(currentUser.id)
        if (!cancelled) setCats(data)
      } catch (error) {
        console.error(error)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [currentUser])

  if (!cats.length) return null

  return (
    <section className="animate-fade-up rounded-[1.75rem] border border-cream-deep bg-surface/80 p-4 backdrop-blur-sm">
      <h3 className="font-brand text-base font-bold text-slate">
        {t.feed.follow}
      </h3>
      <ul className="mt-3 space-y-3">
        {cats.map((cat) => {
          const isFollowing = followingIds.includes(cat.id)
          return (
            <li key={cat.id} className="flex items-center gap-3">
              <Avatar
                src={
                  cat.avatar ||
                  'https://placehold.co/100x100/b8ebe6/3f4f4d?text=Cat'
                }
                alt={cat.name}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate">{cat.name}</p>
                <p className="truncate text-xs text-slate-muted">{cat.breed}</p>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => void toggleFollow(cat.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    isFollowing
                      ? 'bg-cream-deep text-slate-muted'
                      : 'bg-peach text-white hover:bg-coral'
                  }`}
                >
                  {isFollowing ? t.feed.following : t.feed.follow}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void startChatWith(cat.id).then(() => navigate('/messages'))
                  }}
                  className="rounded-xl bg-peach-light px-3 py-1.5 text-xs font-bold text-peach hover:bg-peach-soft"
                >
                  {t.feed.message}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
