import { Navigate, Outlet } from 'react-router-dom'
import { useApp } from '@/context/AppContext'

export function ProtectedRoute() {
  const { isAuthenticated } = useApp()

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return <Outlet />
}
