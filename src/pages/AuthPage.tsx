import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Cat, LoaderCircle, MailCheck } from 'lucide-react'
import { toast } from 'react-toastify'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { SetupBanner } from '@/components/common/SetupBanner'

type AuthMode = 'login' | 'signup' | 'forgot' | 'verify-sent'

export function AuthPage() {
  const {
    signIn,
    signUp,
    requestPasswordReset,
    isAuthenticated,
    isConfigured,
    authReady,
  } = useApp()
  const { t } = useTranslation()
  const [mode, setMode] = useState<AuthMode>('signup')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState('')
  const [form, setForm] = useState({
    email: '',
    password: '',
    username: '',
    name: '',
    breed: '',
    age: '1',
    bio: '',
  })

  if (!authReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-slate-500">
        {t.common.loading}
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setError(null)
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
      if (mode === 'forgot') {
        await requestPasswordReset(form.email)
        toast.success(t.auth.resetEmailSent)
        switchMode('login')
        return
      }

      if (mode === 'login') {
        await signIn({
          email: form.email,
          password: form.password,
        })
        toast.success(t.auth.welcomeBack)
        return
      }

      if (mode === 'signup') {
        // Isolated signup: auth.signUp only — no profile write / image upload here.
        const result = await signUp({
          email: form.email,
          password: form.password,
          username: form.username,
          name: form.name.trim() || 'Cat',
          breed: form.breed.trim() || 'Mixed',
          age: Number(form.age) || 1,
          bio: form.bio.trim(),
          avatarFile: null,
        })

        setPendingEmail(result.email)
        toast.success(t.auth.verifyEmailToast)

        setForm({
          email: '',
          password: '',
          username: '',
          name: '',
          breed: '',
          age: '1',
          bio: '',
        })
        switchMode('verify-sent')
        return
      }
    } catch (err) {
      const authErr = err as Error & { status?: number }
      console.error('[AuthPage] signup/login failed', {
        message: authErr?.message,
        status: authErr?.status,
        err,
      })
      let message =
        err instanceof Error ? err.message : t.auth.authFailed
      if (
        err instanceof Error &&
        (err.name === 'UsernameTakenError' || err.message === 'USERNAME_TAKEN')
      ) {
        message = t.auth.usernameTaken
      } else if (
        err instanceof Error &&
        err.message.toLowerCase().includes('username must be')
      ) {
        message = t.auth.usernameInvalid
      }
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4 flex gap-2">
        <ThemeToggle />
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md space-y-4">
        {!isConfigured ? <SetupBanner /> : null}

        <div className="animate-fade-up overflow-hidden card-panel">
          <div className="bg-gradient-to-br from-white via-pink-50/40 to-orange-50/40 px-6 py-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-purple-600 shadow-sm">
              <Cat className="h-7 w-7" />
            </div>
            <h1 className="font-brand text-3xl font-bold tracking-tight text-slate-700">
              {t.appName}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{t.profile.loginSubtitle}</p>
          </div>

          {mode === 'verify-sent' ? (
            <div className="space-y-4 px-6 py-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 text-purple-600">
                <MailCheck className="h-7 w-7" />
              </div>
              <h2 className="font-brand text-xl font-bold text-slate-700">
                {t.auth.checkInboxTitle}
              </h2>
              <p className="text-sm leading-relaxed text-slate-500">
                {t.auth.verifyEmailBody}{' '}
                <span className="font-semibold text-slate-700">{pendingEmail}</span>
              </p>
              <p className="text-xs text-slate-400">{t.auth.verifyEmailHint}</p>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="btn-primary w-full"
              >
                {t.auth.backToLogin}
              </button>
            </div>
          ) : (
            <form
              onSubmit={(event) => void handleSubmit(event)}
              className="space-y-3 px-6 py-6"
            >
              {mode !== 'forgot' ? (
                <div className="flex rounded-2xl bg-slate-50/80 p-1">
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition duration-300 ${
                      mode === 'signup'
                        ? 'nav-active shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t.profile.signupCta}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition duration-300 ${
                      mode === 'login'
                        ? 'nav-active shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t.profile.loginCta}
                  </button>
                </div>
              ) : (
                <div>
                  <h2 className="font-brand text-lg font-bold text-slate-700">
                    {t.auth.forgotTitle}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t.auth.forgotSubtitle}
                  </p>
                </div>
              )}

              <AuthField
                label={t.profile.email}
                type="email"
                value={form.email}
                onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
                required
              />

              {mode !== 'forgot' ? (
                <AuthField
                  label={t.profile.password}
                  type="password"
                  value={form.password}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, password: value }))
                  }
                  required
                />
              ) : null}

              {mode === 'login' ? (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs font-semibold text-purple-600 hover:text-orange-500"
                  >
                    {t.auth.forgotPassword}
                  </button>
                </div>
              ) : null}

              {mode === 'signup' ? (
                <>
                  <AuthField
                    label={t.profile.username}
                    value={form.username}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        username: value.toLowerCase().replace(/\s+/g, ''),
                      }))
                    }
                    required
                    hint={t.profile.usernameHint}
                    pattern="[a-z0-9_]{3,24}"
                  />
                  <AuthField
                    label={t.profile.name}
                    value={form.name}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, name: value }))
                    }
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
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, age: value }))
                    }
                  />
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t.profile.bio}
                    </span>
                    <textarea
                      value={form.bio}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, bio: event.target.value }))
                      }
                      rows={3}
                      className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-sm outline-none focus:border-pink-300"
                    />
                  </label>
                  <p className="rounded-2xl bg-pink-50/70 px-3 py-2 text-xs text-slate-500">
                    {t.auth.avatarAfterVerify}
                  </p>
                </>
              ) : null}

              {error ? (
                <p className="rounded-2xl bg-purple-50/80 px-3 py-2 text-sm text-rose-400">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting || !isConfigured}
                className="btn-primary mt-2 w-full"
              >
                {submitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    {t.common.loading}
                  </>
                ) : mode === 'login' ? (
                  t.profile.loginCta
                ) : mode === 'forgot' ? (
                  t.auth.sendResetLink
                ) : (
                  t.profile.signupCta
                )}
              </button>

              {mode === 'forgot' ? (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="w-full text-center text-sm font-semibold text-slate-500 hover:text-purple-600"
                >
                  {t.auth.backToLogin}
                </button>
              ) : null}
            </form>
          )}
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
  hint,
  pattern,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  hint?: string
  pattern?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        pattern={pattern}
        minLength={type === 'password' ? 6 : pattern ? 3 : undefined}
        maxLength={pattern ? 24 : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="input-field"
      />
      {hint ? (
        <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>
      ) : null}
    </label>
  )
}
