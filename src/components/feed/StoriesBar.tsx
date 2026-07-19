import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { Avatar } from '@/components/common/Avatar'

export function StoriesBar() {
  const { stories, currentUser } = useApp()
  const { t } = useTranslation()

  if (!currentUser) return null

  return (
    <section className="animate-fade-up rounded-[1.75rem] border border-cream-deep bg-surface/80 px-3 py-4 backdrop-blur-sm sm:px-4">
      <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-muted">
        {t.feed.stories}
      </p>
      <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
        <button type="button" className="flex shrink-0 flex-col items-center gap-1.5">
          <Avatar src={currentUser.avatar} alt={currentUser.name} size="lg" ring />
          <span className="max-w-[4.5rem] truncate text-xs font-semibold text-slate">
            {currentUser.name}
          </span>
        </button>

        {stories.map((story) => (
          <button
            key={story.id}
            type="button"
            className="flex shrink-0 flex-col items-center gap-1.5"
          >
            <Avatar
              src={story.authorAvatar}
              alt={story.authorName}
              size="lg"
              ring={!story.viewed}
              className={story.viewed ? 'opacity-70' : ''}
            />
            <span className="max-w-[4.5rem] truncate text-xs font-medium text-slate-muted">
              {story.authorName}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
