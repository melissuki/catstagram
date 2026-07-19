import { useEffect, useState, type FormEvent } from 'react'
import type { Post } from '@/types'
import { fetchUserPosts } from '@/services/api'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { Avatar } from '@/components/common/Avatar'
import { ImageUpload } from '@/components/common/ImageUpload'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

export function ProfilePage() {
  const { currentUser, updateProfile, followingIds } = useApp()
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [posts, setPosts] = useState<Post[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    name: '',
    breed: '',
    age: '1',
    bio: '',
  })

  useEffect(() => {
    if (!currentUser) return
    setForm({
      name: currentUser.name,
      breed: currentUser.breed,
      age: String(currentUser.age),
      bio: currentUser.bio,
    })
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false

    const load = async () => {
      setLoadingPosts(true)
      try {
        const data = await fetchUserPosts(currentUser.id, currentUser.id)
        if (!cancelled) setPosts(data)
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) setLoadingPosts(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [currentUser])

  if (!currentUser) return null

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await updateProfile({
        name: form.name.trim() || currentUser.name,
        breed: form.breed.trim() || currentUser.breed,
        age: Number(form.age) || currentUser.age,
        bio: form.bio.trim(),
        avatarFile,
      })
      setAvatarFile(null)
      setEditing(false)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="card-panel animate-fade-up p-5 sm:p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <Avatar
            src={currentUser.avatar || 'https://placehold.co/200x200/ccfbf1/334155?text=Cat'}
            alt={currentUser.name}
            size="xl"
            ring
          />
          <div className="flex-1 text-center sm:text-left">
            <h2 className="font-brand text-2xl font-bold text-slate-700">
              {currentUser.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {currentUser.breed} · {currentUser.age} {t.profile.years}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              {currentUser.bio}
            </p>

            <div className="mt-4 flex justify-center gap-6 sm:justify-start">
              <Stat
                label={t.profile.posts}
                value={posts.length || currentUser.postsCount}
              />
              <Stat label={t.profile.followers} value={currentUser.followers} />
              <Stat label={t.profile.following} value={followingIds.length} />
            </div>

            <button
              type="button"
              onClick={() => setEditing((prev) => !prev)}
              className="mt-4 rounded-2xl bg-teal-50 px-4 py-2 text-sm font-bold text-teal-600 transition hover:bg-teal-100"
            >
              {editing ? t.profile.cancel : t.profile.edit}
            </button>
            {saved ? (
              <p className="mt-2 text-sm font-semibold text-emerald-600">
                {t.profile.saved}
              </p>
            ) : null}
          </div>
        </div>

        {editing ? (
          <form
            onSubmit={(event) => void handleSave(event)}
            className="mt-6 grid gap-3 sm:grid-cols-2"
          >
            <Field
              label={t.profile.name}
              value={form.name}
              onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
            />
            <Field
              label={t.profile.breed}
              value={form.breed}
              onChange={(value) => setForm((prev) => ({ ...prev, breed: value }))}
            />
            <Field
              label={t.profile.age}
              type="number"
              value={form.age}
              onChange={(value) => setForm((prev) => ({ ...prev, age: value }))}
            />
            <div className="sm:col-span-2">
              <ImageUpload
                label={t.profile.avatar}
                value={avatarFile}
                onChange={setAvatarFile}
                previewUrl={currentUser.avatar || null}
                helperText={t.feed.photoHint}
                compact
              />
            </div>
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.profile.bio}
              </span>
              <textarea
                value={form.bio}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, bio: event.target.value }))
                }
                rows={3}
                className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-sm outline-none focus:border-teal-300"
              />
            </label>
            {error ? (
              <p className="sm:col-span-2 text-sm text-rose-400">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary sm:col-span-2"
            >
              {submitting ? t.common.loading : t.profile.save}
            </button>
          </form>
        ) : null}
      </section>

      <section className="animate-fade-up">
        <h3 className="mb-3 px-1 font-brand text-lg font-bold text-slate-700">
          {t.profile.posts}
        </h3>
        {loadingPosts ? (
          <LoadingSpinner label={t.common.loading} />
        ) : posts.length === 0 ? (
          <p className="text-sm text-slate-500">{t.feed.noPosts}</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {posts.map((post) => (
              <div
                key={post.id}
                className="aspect-square overflow-hidden rounded-xl bg-slate-100 sm:rounded-2xl"
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
      <p className="font-brand text-lg font-bold text-slate-700">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-sm outline-none focus:border-teal-300"
      />
    </label>
  )
}
