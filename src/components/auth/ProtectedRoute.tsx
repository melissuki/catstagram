import { Navigate, Outlet } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'

export function ProtectedRoute() {
  const { isAuthenticated, authReady } = useApp()
  const { t } = useTranslation()

  if (!authReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-slate-muted">
        {t.common.loading}
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return <Outlet />
}
