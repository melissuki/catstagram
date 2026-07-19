import { ChatList } from '@/components/chat/ChatList'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'

export function MessagesPage() {
  const { activeConversationId, setActiveConversationId } = useApp()
  const { t } = useTranslation()

  return (
    <div className="card-panel mx-auto h-[calc(100dvh-8.5rem)] max-w-5xl overflow-hidden lg:h-[calc(100dvh-4rem)]">
      <div className="grid h-full lg:grid-cols-[300px_minmax(0,1fr)]">
        <div
          className={`h-full border-r border-white/70 ${
            activeConversationId ? 'hidden lg:block' : 'block'
          }`}
        >
          <ChatList />
        </div>

        <div
          className={`h-full ${activeConversationId ? 'block' : 'hidden lg:block'}`}
        >
          {activeConversationId ? (
            <div className="border-b border-white/70 px-3 py-2 lg:hidden">
              <button
                type="button"
                onClick={() => setActiveConversationId(null)}
                className="text-sm font-semibold text-purple-600"
              >
                ← {t.common.back}
              </button>
            </div>
          ) : null}
          <div
            className={
              activeConversationId
                ? 'h-[calc(100%-2.75rem)] lg:h-full'
                : 'h-full'
            }
          >
            <ChatWindow />
          </div>
        </div>
      </div>
    </div>
  )
}
