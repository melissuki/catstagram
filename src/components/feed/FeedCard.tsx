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
      className="card-panel animate-fade-up overflow-hidden"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar
            src={
              post.authorAvatar ||
              'https://placehold.co/100x100/fce7f3/334155?text=Cat'
            }
            alt={post.authorName}
            size="md"
            ring
          />
          <div>
            <p className="text-sm font-bold text-slate-700">{post.authorName}</p>
            <p className="text-xs text-slate-500">
              {new Date(post.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {!isOwn ? (
          <button
            type="button"
            onClick={() => void toggleFollow(post.authorId)}
            className={
              isFollowing
                ? 'rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500'
                : 'btn-primary-sm'
            }
          >
            {isFollowing ? t.feed.following : t.feed.follow}
          </button>
        ) : null}
      </header>

      <div className="aspect-square w-full overflow-hidden bg-gradient-to-br from-slate-50 to-pink-50/40">
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
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 transition hover:text-purple-600"
            aria-label={post.likedByMe ? t.feed.unlike : t.feed.like}
          >
            <Heart
              className={`h-5 w-5 ${
                post.likedByMe
                  ? 'fill-pink-400 text-pink-500'
                  : 'text-slate-400'
              }`}
            />
            {post.likes}
          </button>
          <button
            type="button"
            onClick={() => setShowComments((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-700"
          >
            <MessageCircle className="h-5 w-5" />
            {post.comments.length}
          </button>
        </div>

        <div>
          <p className="text-sm leading-relaxed text-slate-700">
            <span className="font-bold">{post.authorName}</span>{' '}
            {post.caption}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-lg bg-gradient-to-r from-purple-50 via-pink-50 to-orange-50 px-2 py-0.5 text-xs font-semibold text-purple-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {showComments ? (
          <div className="space-y-2 rounded-2xl border border-white/80 bg-slate-50/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.feed.comments}
            </p>
            {post.comments.length === 0 ? (
              <p className="text-sm text-slate-500">…</p>
            ) : (
              post.comments.map((item) => (
                <div key={item.id} className="flex gap-2 text-sm">
                  <Avatar src={item.authorAvatar} alt={item.authorName} size="sm" />
                  <p>
                    <span className="font-bold text-slate-700">{item.authorName}</span>{' '}
                    <span className="text-slate-500">{item.text}</span>
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
            className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-pink-300 focus:bg-white"
          />
          <button
            type="submit"
            disabled={!comment.trim()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 text-white shadow-sm transition hover:from-purple-500 hover:via-pink-500 hover:to-orange-500 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400"
            aria-label={t.feed.post}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </article>
  )
}
