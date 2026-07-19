import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Cat, LoaderCircle } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { ImageUpload } from '@/components/common/ImageUpload'
import { SetupBanner } from '@/components/common/SetupBanner'

export function AuthPage() {
  const { signIn, signUp, isAuthenticated, isConfigured, authReady } = useApp()
  const { t } = useTranslation()
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    breed: '',
    age: '1',
    bio: '',
  })

  if (!authReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-slate-muted">
        {t.common.loading}
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!isConfigured) {
      setError(t.setup.title)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      if (mode === 'login') {
        await signIn({
          email: form.email,
          password: form.password,
        })
      } else {
        await signUp({
          email: form.email,
          password: form.password,
          name: form.name.trim() || 'Cat',
          breed: form.breed.trim() || 'Mixed',
          age: Number(form.age) || 1,
          bio: form.bio.trim(),
          avatarFile,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md space-y-4">
        {!isConfigured ? <SetupBanner /> : null}

        <div className="animate-fade-up overflow-hidden rounded-[2rem] border border-cream-deep bg-surface/90 shadow-[0_24px_60px_-30px_rgba(63,79,77,0.22)] backdrop-blur-md">
          <div className="bg-gradient-to-br from-peach-light via-cream to-peach-soft/50 px-6 py-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-peach shadow-sm">
              <Cat className="h-7 w-7" />
            </div>
            <h1 className="font-brand text-3xl font-bold tracking-tight text-slate">
              {t.appName}
            </h1>
            <p className="mt-2 text-sm text-slate-muted">{t.profile.loginSubtitle}</p>
          </div>

          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="space-y-3 px-6 py-6"
          >
            <div className="flex rounded-2xl bg-cream-soft p-1">
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${
                  mode === 'signup'
                    ? 'bg-surface text-peach shadow-sm'
                    : 'text-slate-muted'
                }`}
              >
                {t.profile.signupCta}
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${
                  mode === 'login'
                    ? 'bg-surface text-peach shadow-sm'
                    : 'text-slate-muted'
                }`}
              >
                {t.profile.loginCta}
              </button>
            </div>

            <AuthField
              label={t.profile.email}
              type="email"
              value={form.email}
              onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
              required
            />
            <AuthField
              label={t.profile.password}
              type="password"
              value={form.password}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, password: value }))
              }
              required
            />

            {mode === 'signup' ? (
              <>
                <AuthField
                  label={t.profile.name}
                  value={form.name}
                  onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                  required
                />
                <AuthField
                  label={t.profile.breed}
                  value={form.breed}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, breed: value }))
                  }
                />
                <AuthField
                  label={t.profile.age}
                  type="number"
                  value={form.age}
                  onChange={(value) => setForm((prev) => ({ ...prev, age: value }))}
                />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-muted">
                    {t.profile.bio}
                  </span>
                  <textarea
                    value={form.bio}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, bio: event.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-2xl border border-cream-deep bg-cream-soft/70 px-3 py-2.5 text-sm outline-none focus:border-peach-soft"
                  />
                </label>
                <ImageUpload
                  label={t.profile.avatar}
                  value={avatarFile}
                  onChange={setAvatarFile}
                  helperText={t.feed.photoHint}
                  compact
                />
              </>
            ) : null}

            {error ? (
              <p className="rounded-2xl bg-peach-light/70 px-3 py-2 text-sm text-streak">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !isConfigured}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-peach py-3 text-sm font-bold text-white transition hover:bg-coral disabled:cursor-not-allowed disabled:bg-cream-deep disabled:text-slate-soft"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {t.common.loading}
                </>
              ) : mode === 'login' ? (
                t.profile.loginCta
              ) : (
                t.profile.signupCta
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function AuthField({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-cream-deep bg-cream-soft/70 px-3 py-2.5 text-sm outline-none focus:border-peach-soft"
      />
    </label>
  )
}
