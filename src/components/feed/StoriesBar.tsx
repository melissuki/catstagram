import { useCallback, useMemo, useRef, useState } from 'react'
import { LoaderCircle, Plus } from 'lucide-react'
import { toast } from 'react-toastify'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { groupStoriesIntoRings } from '@/services/api'
import type { Story } from '@/types'
import { Avatar } from '@/components/common/Avatar'
import { StoryViewer } from '@/components/feed/StoryViewer'

export function StoriesBar() {
  const { stories, currentUser, createStory, markStoriesAsViewed } = useApp()
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [viewerStories, setViewerStories] = useState<Story[] | null>(null)

  const { own, friends } = useMemo(() => {
    if (!currentUser) return { own: null, friends: [] }
    return groupStoriesIntoRings(stories, currentUser.id)
  }, [stories, currentUser])

  const handleComplete = useCallback(
    (ids: string[]) => {
      markStoriesAsViewed(ids)
    },
    [markStoriesAsViewed],
  )

  const handleClose = useCallback(() => {
    setViewerStories(null)
  }, [])

  if (!currentUser) return null

  const openRing = (items: Story[]) => {
    if (!items.length) return
    setViewerStories(items)
  }

  const handleUpload = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error(t.feed.needPhoto)
      return
    }

    setUploading(true)
    try {
      await createStory(file)
      toast.success(t.feed.storyPosted)
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : t.feed.storyUploadFailed,
      )
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <section className="card-panel animate-fade-up px-3 py-4 sm:px-4">
        <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          {t.feed.stories}
        </p>

        <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <div className="relative">
              <button
                type="button"
                disabled={uploading}
                onClick={() => {
                  if (own?.items.length) openRing(own.items)
                  else fileInputRef.current?.click()
                }}
                className="rounded-full"
                aria-label={own ? t.feed.yourStory : t.feed.addStory}
              >
                {own ? (
                  <Avatar
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    size="lg"
                    ring={own.hasUnviewed}
                    className={own.hasUnviewed ? '' : 'opacity-80'}
                  />
                ) : (
                  <div className="story-ring rounded-full p-[2.5px] shadow-sm">
                    <div className="rounded-full bg-white p-[2px] dark:bg-slate-900">
                      <Avatar
                        src={currentUser.avatar}
                        alt={currentUser.name}
                        size="lg"
                      />
                    </div>
                  </div>
                )}
              </button>

              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white shadow-md transition hover:scale-105 disabled:opacity-70 dark:border-slate-900"
                aria-label={t.feed.addStory}
              >
                {uploading ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                )}
              </button>
            </div>
            <span className="max-w-[4.5rem] truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
              {t.feed.yourStory}
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void handleUpload(event.target.files?.[0])}
          />

          {friends.map((ring) => (
            <button
              key={ring.authorId}
              type="button"
              onClick={() => openRing(ring.items)}
              className="flex shrink-0 flex-col items-center gap-1.5"
            >
              <Avatar
                src={ring.authorAvatar}
                alt={ring.authorName}
                size="lg"
                ring={ring.hasUnviewed}
                className={ring.hasUnviewed ? '' : 'opacity-70'}
              />
              <span className="max-w-[4.5rem] truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                {ring.authorName}
              </span>
            </button>
          ))}
        </div>
      </section>

      {viewerStories ? (
        <StoryViewer
          stories={viewerStories}
          onClose={handleClose}
          onComplete={handleComplete}
        />
      ) : null}
    </>
  )
}
