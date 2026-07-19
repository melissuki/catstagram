import { useState, type FormEvent } from 'react'
import { Heart, MessageCircle, Send } from 'lucide-react'
import type { Post } from '@/types'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { Avatar } from '@/components/common/Avatar'

interface FeedCardProps {
  post: Post
  index?: number
}

export function FeedCard({ post, index = 0 }: FeedCardProps) {
  const { toggleLike, addComment, followingIds, toggleFollow, currentUser } =
    useApp()
  const { t } = useTranslation()
  const [comment, setComment] = useState('')
  const [showComments, setShowComments] = useState(false)

  const isOwn = currentUser?.id === post.authorId
  const isFollowing = followingIds.includes(post.authorId)

  const handleComment = (event: FormEvent) => {
    event.preventDefault()
    const text = comment
    setComment('')
    setShowComments(true)
    void addComment(post.id, text)
  }

  return (
    <article
      className="animate-fade-up overflow-hidden rounded-[1.75rem] border border-cream-deep bg-surface/90 shadow-[0_10px_30px_-18px_rgba(92,90,102,0.35)] backdrop-blur-sm"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar
            src={
              post.authorAvatar ||
              'https://placehold.co/100x100/ffd6c0/5c5a66?text=Cat'
            }
            alt={post.authorName}
            size="md"
            ring
          />
          <div>
            <p className="text-sm font-bold text-slate">{post.authorName}</p>
            <p className="text-xs text-slate-muted">
              {new Date(post.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {!isOwn ? (
          <button
            type="button"
            onClick={() => void toggleFollow(post.authorId)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              isFollowing
                ? 'bg-cream-deep text-slate-muted'
                : 'bg-peach-light text-peach hover:bg-peach-soft'
            }`}
          >
            {isFollowing ? t.feed.following : t.feed.follow}
          </button>
        ) : null}
      </header>

      <div className="aspect-square w-full overflow-hidden bg-cream-deep">
        <img
          src={post.image}
          alt={post.caption}
          className="h-full w-full object-cover transition duration-500 hover:scale-[1.02]"
        />
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => void toggleLike(post.id)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate transition hover:text-streak"
            aria-label={post.likedByMe ? t.feed.unlike : t.feed.like}
          >
            <Heart
              className={`h-5 w-5 ${
                post.likedByMe ? 'fill-streak text-streak' : 'text-slate-muted'
              }`}
            />
            {post.likes}
          </button>
          <button
            type="button"
            onClick={() => setShowComments((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-muted transition hover:text-slate"
          >
            <MessageCircle className="h-5 w-5" />
            {post.comments.length}
          </button>
        </div>

        <div>
          <p className="text-sm leading-relaxed text-slate">
            <span className="font-bold">{post.authorName}</span>{' '}
            {post.caption}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-lg bg-peach-light/70 px-2 py-0.5 text-xs font-semibold text-peach"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {showComments ? (
          <div className="space-y-2 rounded-2xl bg-cream-soft/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-muted">
              {t.feed.comments}
            </p>
            {post.comments.length === 0 ? (
              <p className="text-sm text-slate-muted">…</p>
            ) : (
              post.comments.map((item) => (
                <div key={item.id} className="flex gap-2 text-sm">
                  <Avatar src={item.authorAvatar} alt={item.authorName} size="sm" />
                  <p>
                    <span className="font-bold text-slate">{item.authorName}</span>{' '}
                    <span className="text-slate-muted">{item.text}</span>
                  </p>
                </div>
              ))
            )}
          </div>
        ) : null}

        <form onSubmit={handleComment} className="flex items-center gap-2">
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t.feed.addComment}
            className="w-full rounded-2xl border border-cream-deep bg-cream-soft/60 px-3 py-2.5 text-sm outline-none transition focus:border-peach-soft focus:bg-surface"
          />
          <button
            type="submit"
            disabled={!comment.trim()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-peach text-white transition hover:bg-coral disabled:cursor-not-allowed disabled:bg-cream-deep disabled:text-slate-soft"
            aria-label={t.feed.post}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </article>
  )
}
