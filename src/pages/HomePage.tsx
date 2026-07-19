import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { StoriesBar } from '@/components/feed/StoriesBar'
import { FeedCard } from '@/components/feed/FeedCard'
import { SuggestedFriends } from '@/components/feed/SuggestedFriends'
import { CreatePost } from '@/components/feed/CreatePost'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { SetupBanner } from '@/components/common/SetupBanner'
import { Gamepad2 } from 'lucide-react'

export function HomePage() {
  const { posts, feedLoading, feedError, refreshFeed, isConfigured, openGame } =
    useApp()
  const { t } = useTranslation()

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,640px)_300px] xl:justify-center">
      <div className="space-y-5">
        <header className="animate-fade-up flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="font-brand text-2xl font-bold text-slate-700 sm:text-3xl dark:text-slate-100">
              {t.feed.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500 sm:text-base dark:text-slate-400">
              {t.feed.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={openGame}
            className="btn-primary-sm shrink-0 lg:hidden"
          >
            <Gamepad2 className="h-4 w-4" />
            {t.game.play}
          </button>
        </header>

        {!isConfigured ? <SetupBanner /> : null}

        <CreatePost />
        <StoriesBar />

        {feedLoading ? <LoadingSpinner label={t.feed.loading} /> : null}

        {feedError ? (
          <div className="card-panel px-4 py-6 text-center">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              {feedError || t.feed.error}
            </p>
            <button
              type="button"
              onClick={() => void refreshFeed()}
              className="btn-primary-sm mt-3"
            >
              {t.feed.retry}
            </button>
          </div>
        ) : null}

        {!feedLoading && !feedError && posts.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            {t.feed.noPosts}
          </p>
        ) : null}

        <div className="space-y-5">
          {posts.map((post, index) => (
            <FeedCard key={post.id} post={post} index={index} />
          ))}
        </div>
      </div>

      <aside className="hidden space-y-4 lg:block">
        <div className="sticky top-6 space-y-4">
          <section className="card-panel animate-fade-up overflow-hidden bg-gradient-to-br from-white via-pink-50/40 to-orange-50/30 p-4 dark:from-slate-900 dark:via-purple-950/30 dark:to-slate-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-brand text-lg font-bold text-slate-700 dark:text-slate-100">
                  {t.game.title}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t.game.subtitle}
                </p>
              </div>
              <Gamepad2 className="h-5 w-5 text-pink-500" />
            </div>
            <button type="button" onClick={openGame} className="btn-primary mt-4 w-full">
              <Gamepad2 className="h-4 w-4" />
              {t.game.play}
            </button>
          </section>
          <SuggestedFriends />
        </div>
      </aside>
    </div>
  )
}
