import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomTabs } from '@/components/layout/BottomTabs'

export function AppLayout() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl">
      <Sidebar />
      <div className="flex min-h-dvh flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-3 pb-24 pt-4 sm:px-5 lg:px-8 lg:pb-8 lg:pt-6">
          <Outlet />
        </main>
        <BottomTabs />
      </div>
    </div>
  )
}
