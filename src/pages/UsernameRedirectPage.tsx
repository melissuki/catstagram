import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { fetchProfileByUsername } from '@/services/api'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { profilePath } from '@/utils/username'

/** Legacy `/u/:username` → canonical `/profile/:userId` isolation route. */
export function UsernameRedirectPage() {
  const { username = '' } = useParams()
  const { currentUser } = useApp()
  const { t } = useTranslation()
  const [targetId, setTargetId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!username) return
    let cancelled = false

    void fetchProfileByUsername(username)
      .then((profile) => {
        if (cancelled) return
        setTargetId(profile.id)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t.search.empty)
        }
      })

    return () => {
      cancelled = true
    }
  }, [username, t.search.empty])

  if (targetId) {
    if (currentUser && currentUser.id === targetId) {
      return <Navigate to="/profile" replace />
    }
    return <Navigate to={profilePath(targetId)} replace />
  }

  if (error) {
    return (
      <div className="card-panel mx-auto max-w-lg p-6 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
        <Link to="/search" className="btn-primary mt-4 inline-flex">
          {t.nav.search}
        </Link>
      </div>
    )
  }

  return <LoadingSpinner label={t.common.loading} />
}
