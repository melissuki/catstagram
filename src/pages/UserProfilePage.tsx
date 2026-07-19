import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Gamepad2 } from 'lucide-react'
import type { CatProfile, Post } from '@/types'
import { fetchProfileById, fetchUserPosts } from '@/services/api'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { Avatar } from '@/components/common/Avatar'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

/**
 * Isolated public profile by user ID — never reads or writes session profile state
 * for the viewed cat (except follow/message actions scoped to the viewer).
 */
export function UserProfilePage() {
  const { userId = '' } = useParams()
  const { currentUser, followingIds, toggleFollow, startChatWith } = useApp()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<CatProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return

    // Own profile → editable settings page (never render public view as "me")
    if (currentUser && currentUser.id === userId) {
      navigate('/profile', { replace: true })
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setProfile(null)
    setPosts([])

    void (async () => {
      try {
        const next = await fetchProfileById(userId)
        if (cancelled) return
        // Identity check after fetch — never trust username string equality alone
        if (currentUser && next.id === currentUser.id) {
          navigate('/profile', { replace: true })
          return
        }
        setProfile(next)
        const userPosts = await fetchUserPosts(next.id, currentUser?.id ?? null)
        if (!cancelled) setPosts(userPosts)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t.feed.error)
          setProfile(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, currentUser?.id, navigate, t.feed.error])

  if (loading) return <LoadingSpinner label={t.common.loading} />

  if (error || !profile) {
    return (
      <div className="card-panel mx-auto max-w-lg p-6 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {error || t.search.empty}
        </p>
        <Link to="/search" className="btn-primary mt-4 inline-flex">
          {t.nav.search}
        </Link>
      </div>
    )
  }

  const isFollowing = followingIds.includes(profile.id)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="card-panel animate-fade-up p-5 sm:p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <Avatar src={profile.avatar} alt={profile.name} size="xl" ring />
          <div className="flex-1 text-center sm:text-left">
            <h2 className="font-brand text-2xl font-bold text-slate-700 dark:text-slate-100">
              {profile.name}
            </h2>
            <p className="mt-0.5 text-sm font-semibold text-pink-500">
              @{profile.username}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {profile.breed} · {profile.age} {t.profile.years}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {profile.bio}
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-6 sm:justify-start">
              <Stat
                label={t.profile.posts}
                value={posts.length || profile.postsCount}
              />
              <Stat label={t.profile.followers} value={profile.followers} />
              <Stat label={t.profile.following} value={profile.following} />
              <div className="flex items-center gap-1.5">
                <Gamepad2 className="h-4 w-4 text-pink-500" />
                <Stat label={t.game.highScore} value={profile.gameHighScore} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <button
                type="button"
                onClick={() => void toggleFollow(profile.id)}
                className={isFollowing ? 'btn-soft' : 'btn-primary-sm'}
              >
                {isFollowing ? t.feed.unfollow : t.feed.follow}
              </button>
              <button
                type="button"
                onClick={() => {
                  void startChatWith(profile.id)
                    .then(() => navigate('/messages'))
                    .catch((error: Error) => {
                      if (error.message === 'AUTH_REQUIRED') return
                      console.error(error)
                    })
                }}
                className="btn-soft"
              >
                {t.messages.sendMessage}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="animate-fade-up">
        <h3 className="mb-3 px-1 font-brand text-lg font-bold text-slate-700 dark:text-slate-100">
          {t.profile.posts}
        </h3>
        {posts.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.feed.noPosts}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {posts.map((post) => (
              <div
                key={post.id}
                className="aspect-square overflow-hidden rounded-xl bg-purple-50 dark:bg-slate-800 sm:rounded-2xl"
              >
                <img
                  src={post.image}
                  alt={post.caption}
                  className="h-full w-full object-cover transition hover:scale-105"
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-brand text-lg font-bold text-slate-700 dark:text-slate-100">
        {value}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}
