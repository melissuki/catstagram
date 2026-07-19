import { useEffect, useState, type FormEvent } from 'react'
import { Cat, LoaderCircle, MailCheck, X } from 'lucide-react'
import { toast } from 'react-toastify'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { toUserFacingError } from '@/utils/userFacingError'
import { sanitizeUserText } from '@/utils/sanitize'

type AuthMode = 'login' | 'signup' | 'forgot' | 'verify-sent'

/**
 * Soft sunset pastel gate for guests who try to interact.
 * Keeps email verification + password reset flows.
 */
export function AuthGateModal() {
  const {
    authModalOpen,
    closeAuthModal,
    signIn,
    signUp,
    requestPasswordReset,
    isConfigured,
    isAuthenticated,
  } = useApp()
  const { t } = useTranslation()
  const [mode, setMode] = useState<AuthMode>('login')
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

  useEffect(() => {
    if (!authModalOpen) return
    setMode('login')
    setError(null)
    setSubmitting(false)
  }, [authModalOpen])

  useEffect(() => {
    if (isAuthenticated && authModalOpen) closeAuthModal()
  }, [isAuthenticated, authModalOpen, closeAuthModal])

  useEffect(() => {
    if (!authModalOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAuthModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [authModalOpen, closeAuthModal])

  if (!authModalOpen) return null

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setError(null)
  }

  const friendlyAuthMessage = (err: unknown): string => {
    const code = toUserFacingError(err, t.auth.authFailed)
    if (code === 'USERNAME_TAKEN') return t.auth.usernameTaken
    if (code === 'USERNAME_INVALID') return t.auth.usernameInvalid
    if (code === 'EMAIL_NOT_CONFIRMED') return t.auth.verifyEmailHint
    if (code === 'INVALID_CREDENTIALS') return t.auth.invalidCredentials
    if (code === 'RATE_LIMITED') return t.auth.rateLimited
    if (code === 'NETWORK') return t.auth.networkError
    if (code === 'NOT_CONFIGURED') return t.setup.title
    return code === t.auth.authFailed ? t.auth.authFailed : code
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!isConfigured) {
      setError(t.setup.title)
      toast.error(t.setup.title)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      if (mode === 'forgot') {
        await requestPasswordReset(form.email.trim())
        toast.success(t.auth.resetEmailSent)
        switchMode('login')
        return
      }

      if (mode === 'login') {
        await signIn({ email: form.email, password: form.password })
        toast.success(t.auth.welcomeBack)
        closeAuthModal()
        return
      }

      if (mode === 'signup') {
        const result = await signUp({
          email: form.email,
          password: form.password,
          username: form.username,
          name: sanitizeUserText(form.name, 80) || 'Cat',
          breed: sanitizeUserText(form.breed, 80) || 'Mixed',
          age: Number(form.age) || 1,
          bio: sanitizeUserText(form.bio, 500),
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
      }
    } catch (err) {
      const message = friendlyAuthMessage(err)
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={t.common.back}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        onClick={closeAuthModal}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-gate-title"
        className="relative z-10 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-purple-100/50 bg-gradient-to-b from-white via-pink-50/50 to-orange-50/40 shadow-2xl animate-fade-up sm:rounded-3xl dark:border-purple-500/25 dark:from-slate-950 dark:via-purple-950/40 dark:to-slate-900"
      >
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute right-3 top-3 rounded-full bg-white/80 p-2 text-slate-500 transition hover:text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          aria-label={t.common.back}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pb-2 pt-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-200/60 via-pink-200/50 to-orange-200/50 text-purple-600 dark:text-pink-300">
            <Cat className="h-6 w-6" />
          </div>
          <h2
            id="auth-gate-title"
            className="font-brand text-2xl font-bold text-slate-700 dark:text-slate-100"
          >
            {t.auth.gateTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {t.auth.gateBody}
          </p>
        </div>

        {mode === 'verify-sent' ? (
          <div className="space-y-4 px-6 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 text-purple-600">
              <MailCheck className="h-6 w-6" />
            </div>
            <p className="text-sm text-slate-500">
              {t.auth.verifyEmailBody}{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {pendingEmail}
              </span>
            </p>
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
            className="space-y-3 px-6 pb-8 pt-2"
          >
            {mode !== 'forgot' ? (
              <div className="flex rounded-2xl bg-white/70 p-1 dark:bg-slate-900/60">
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${
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
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${
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
                <p className="font-brand text-lg font-bold text-slate-700 dark:text-slate-100">
                  {t.auth.forgotTitle}
                </p>
                <p className="mt-1 text-sm text-slate-500">{t.auth.forgotSubtitle}</p>
              </div>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.profile.email}
              </span>
              <input
                type="email"
                required
                value={form.email}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
                className="input-field"
              />
            </label>

            {mode !== 'forgot' ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t.profile.password}
                </span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  className="input-field"
                />
              </label>
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
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t.profile.username}
                  </span>
                  <input
                    required
                    pattern="[a-z0-9_]{3,24}"
                    value={form.username}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        username: event.target.value
                          .toLowerCase()
                          .replace(/\s+/g, ''),
                      }))
                    }
                    className="input-field"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t.profile.name}
                  </span>
                  <input
                    required
                    value={form.name}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="input-field"
                  />
                </label>
              </>
            ) : null}

            {error ? (
              <p className="rounded-2xl bg-rose-50/90 px-3 py-2 text-sm text-rose-500 dark:bg-rose-950/40">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !isConfigured}
              className="btn-primary w-full"
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
            ) : (
              <button
                type="button"
                onClick={closeAuthModal}
                className="w-full text-center text-sm font-semibold text-slate-400 hover:text-slate-600"
              >
                {t.auth.continueExploring}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
