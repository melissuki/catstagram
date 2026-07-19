import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Cat, LoaderCircle, LockKeyhole } from 'lucide-react'
import { toast } from 'react-toastify'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { requireSupabase, isSupabaseConfigured } from '@/services/supabaseClient'
import { LanguageToggle } from '@/components/common/LanguageToggle'

export function ResetPasswordPage() {
  const { updatePassword, logout, authReady } = useApp()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authReady || !isSupabaseConfigured) return

    const supabase = requireSupabase()
    let mounted = true

    void supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) setReady(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY' || Boolean(session)) {
        setReady(true)
      }
    })

    const timer = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data }) => {
        if (mounted && data.session) setReady(true)
      })
    }, 900)

    return () => {
      mounted = false
      window.clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [authReady])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError(t.auth.passwordTooShort)
      return
    }

    if (password !== confirm) {
      setError(t.auth.passwordMismatch)
      return
    }

    setSubmitting(true)
    try {
      await updatePassword(password)
      toast.success(t.auth.passwordUpdated)
      await logout()
      navigate('/auth', { replace: true })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t.auth.authFailed
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md animate-fade-up overflow-hidden card-panel">
        <div className="bg-gradient-to-br from-white via-teal-50/40 to-emerald-50/50 px-6 py-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-teal-600 shadow-sm">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <h1 className="font-brand text-2xl font-bold text-slate-700">
            {t.auth.resetTitle}
          </h1>
          <p className="mt-2 text-sm text-slate-500">{t.auth.resetSubtitle}</p>
        </div>

        {!ready ? (
          <div className="space-y-4 px-6 py-8 text-center">
            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-teal-600" />
            <p className="text-sm text-slate-500">{t.auth.waitingRecovery}</p>
            <p className="text-xs text-slate-400">{t.auth.recoveryHint}</p>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-emerald-600"
            >
              <Cat className="h-4 w-4" />
              {t.auth.backToLogin}
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="space-y-3 px-6 py-6"
          >
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.auth.newPassword}
              </span>
              <input
                type="password"
                value={password}
                minLength={6}
                required
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-sm outline-none focus:border-teal-300"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.auth.confirmPassword}
              </span>
              <input
                type="password"
                value={confirm}
                minLength={6}
                required
                onChange={(event) => setConfirm(event.target.value)}
                className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-sm outline-none focus:border-teal-300"
              />
            </label>

            {error ? (
              <p className="rounded-2xl bg-teal-50/80 px-3 py-2 text-sm text-rose-400">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {t.common.loading}
                </>
              ) : (
                t.auth.updatePassword
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
