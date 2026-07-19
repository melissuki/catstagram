import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'

/** Soft gate: bounce guests home and open the Auth modal. */
export function ProtectedRoute() {
  const { isAuthenticated, authReady, openAuthModal } = useApp()
  const { t } = useTranslation()

  useEffect(() => {
    if (authReady && !isAuthenticated) openAuthModal()
  }, [authReady, isAuthenticated, openAuthModal])

  if (!authReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        {t.common.loading}
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
