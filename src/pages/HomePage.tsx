import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { StoriesBar } from '@/components/feed/StoriesBar'
import { FeedCard } from '@/components/feed/FeedCard'
import { SuggestedFriends } from '@/components/feed/SuggestedFriends'
import { CreatePost } from '@/components/feed/CreatePost'
import { MamaStreakWidget } from '@/components/streak/MamaStreakWidget'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { SetupBanner } from '@/components/common/SetupBanner'

export function HomePage() {
  const { posts, feedLoading, feedError, refreshFeed, isConfigured } = useApp()
  const { t } = useTranslation()

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,640px)_300px] xl:justify-center">
      <div className="space-y-5">
        <header className="animate-fade-up px-1">
          <h2 className="font-brand text-2xl font-bold text-slate sm:text-3xl">
            {t.feed.title}
          </h2>
          <p className="mt-1 text-sm text-slate-muted sm:text-base">
            {t.feed.subtitle}
          </p>
        </header>

        {!isConfigured ? <SetupBanner /> : null}

        <CreatePost />
        <StoriesBar />

        <div className="lg:hidden">
          <MamaStreakWidget compact />
        </div>

        {feedLoading ? <LoadingSpinner label={t.feed.loading} /> : null}

        {feedError ? (
          <div className="rounded-[1.5rem] border border-coral/30 bg-peach-light/50 px-4 py-6 text-center">
            <p className="text-sm text-slate">{feedError || t.feed.error}</p>
            <button
              type="button"
              onClick={() => void refreshFeed()}
              className="mt-3 rounded-xl bg-peach px-4 py-2 text-sm font-bold text-white"
            >
              {t.feed.retry}
            </button>
          </div>
        ) : null}

        {!feedLoading && !feedError && posts.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-muted">
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
          <MamaStreakWidget compact />
          <SuggestedFriends />
        </div>
      </aside>
    </div>
  )
}
