import { useMemo, useState } from 'react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { Avatar } from '@/components/common/Avatar'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

export function ChatList() {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    chatsLoading,
  } = useApp()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return conversations
    return conversations.filter((chat) =>
      chat.participantName.toLowerCase().includes(normalized),
    )
  }, [conversations, query])

  if (chatsLoading) {
    return <LoadingSpinner label={t.common.loading} />
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/70 px-4 py-4">
        <h2 className="font-brand text-xl font-bold text-slate-700">
          {t.messages.title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t.messages.subtitle}</p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.messages.search}
          className="mt-3 w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-teal-300"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            {t.messages.noChats}
          </p>
        ) : (
          filtered.map((chat) => {
            const active = chat.id === activeConversationId
            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => setActiveConversationId(chat.id)}
                className={`flex w-full items-center gap-3 border-b border-white/60 px-4 py-3 text-left transition duration-300 ${
                  active
                    ? 'bg-gradient-to-r from-teal-50/90 to-emerald-50/70'
                    : 'hover:bg-slate-50/80'
                }`}
              >
                <Avatar
                  src={chat.participantAvatar}
                  alt={chat.participantName}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold text-slate-700">
                      {chat.participantName}
                    </p>
                    {chat.unread > 0 ? (
                      <span className="rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        {chat.unread}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {chat.lastMessage}
                  </p>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
