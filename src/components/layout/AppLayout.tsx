import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomTabs } from '@/components/layout/BottomTabs'
import { TreatCatcherModal } from '@/components/game/TreatCatcherModal'
import { NotificationsDrawer } from '@/components/notifications/NotificationsDrawer'
import { RealtimeAlerts } from '@/components/realtime/RealtimeAlerts'
import { useApp } from '@/context/AppContext'

export function AppLayout() {
  const { gameOpen, closeGame } = useApp()

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-3 py-4 pb-24 sm:px-5 sm:py-6 lg:pb-6">
          <Outlet />
        </main>
        <BottomTabs />
      </div>
      <NotificationsDrawer />
      <TreatCatcherModal open={gameOpen} onClose={closeGame} />
      <RealtimeAlerts />
    </div>
  )
}
