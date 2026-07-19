import { useState, type FormEvent } from 'react'
import { LoaderCircle, Sparkles } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { ImageUpload } from '@/components/common/ImageUpload'

export function CreatePost() {
  const { createPost } = useApp()
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file) {
      setError(t.feed.needPhoto)
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      await createPost(file, caption)
      setFile(null)
      setCaption('')
      setSuccess(true)
      window.setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.feed.error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="animate-fade-up rounded-[1.75rem] border border-cream-deep bg-surface/90 p-4 backdrop-blur-sm sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-peach" />
        <h3 className="font-brand text-base font-bold text-slate">
          {t.feed.createPost}
        </h3>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
        <ImageUpload
          label={t.feed.photo}
          value={file}
          onChange={setFile}
          helperText={t.feed.photoHint}
          compact
        />

        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder={t.feed.captionPlaceholder}
          rows={3}
          className="w-full rounded-2xl border border-cream-deep bg-cream-soft/70 px-3 py-2.5 text-sm outline-none focus:border-peach-soft"
        />

        {error ? <p className="text-sm font-medium text-streak">{error}</p> : null}
        {success ? (
          <p className="text-sm font-medium text-success">{t.feed.posted}</p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || !file}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-peach px-4 py-3 text-sm font-bold text-white transition hover:bg-coral disabled:cursor-not-allowed disabled:bg-cream-deep disabled:text-slate-soft"
        >
          {submitting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              {t.feed.uploading}
            </>
          ) : (
            t.feed.sharePost
          )}
        </button>
      </form>
    </section>
  )
}
