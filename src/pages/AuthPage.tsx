import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Cat } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { mockProfiles } from '@/services/mockData'

export function AuthPage() {
  const { login, isAuthenticated } = useApp()
  const { t } = useTranslation()
  const defaults = mockProfiles[0]

  const [form, setForm] = useState({
    name: defaults.name,
    breed: defaults.breed,
    age: String(defaults.age),
    bio: defaults.bio,
    avatar: defaults.avatar,
  })

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    login({
      name: form.name.trim() || defaults.name,
      breed: form.breed.trim() || defaults.breed,
      age: Number(form.age) || defaults.age,
      bio: form.bio.trim() || defaults.bio,
      avatar: form.avatar.trim() || defaults.avatar,
    })
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <LanguageToggle />
      </div>

      <div className="animate-fade-up w-full max-w-md overflow-hidden rounded-[2rem] border border-cream-deep bg-surface/90 shadow-[0_24px_60px_-30px_rgba(92,90,102,0.45)] backdrop-blur-md">
        <div className="bg-gradient-to-br from-peach-light via-cream to-peach-soft/50 px-6 py-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-peach shadow-sm">
            <Cat className="h-7 w-7" />
          </div>
          <h1 className="font-brand text-3xl font-bold tracking-tight text-slate">
            {t.appName}
          </h1>
          <p className="mt-2 text-sm text-slate-muted">{t.profile.loginSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-6 py-6">
          <h2 className="font-brand text-lg font-bold text-slate">
            {t.profile.loginTitle}
          </h2>

          <AuthField
            label={t.profile.name}
            value={form.name}
            onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
          />
          <AuthField
            label={t.profile.breed}
            value={form.breed}
            onChange={(value) => setForm((prev) => ({ ...prev, breed: value }))}
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
          <AuthField
            label={t.profile.avatar}
            value={form.avatar}
            onChange={(value) => setForm((prev) => ({ ...prev, avatar: value }))}
          />

          <button
            type="submit"
            className="mt-2 w-full rounded-2xl bg-peach py-3 text-sm font-bold text-white transition hover:bg-coral"
          >
            {t.profile.loginCta}
          </button>
        </form>
      </div>
    </div>
  )
}

function AuthField({
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
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-cream-deep bg-cream-soft/70 px-3 py-2.5 text-sm outline-none focus:border-peach-soft"
        required={type !== 'number' ? undefined : undefined}
      />
    </label>
  )
}
