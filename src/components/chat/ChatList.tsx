import { useMemo, useState } from 'react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { Avatar } from '@/components/common/Avatar'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { formatRelativeTime } from '@/utils/relativeTime'

export function ChatList() {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    chatsLoading,
    language,
  } = useApp()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase().replace(/^@+/, '')
    if (!normalized) return conversations
    return conversations.filter(
      (chat) =>
        chat.participantName.toLowerCase().includes(normalized) ||
        chat.participantUsername.toLowerCase().includes(normalized),
    )
  }, [conversations, query])

  if (chatsLoading) {
    return <LoadingSpinner label={t.common.loading} />
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-purple-100/40 px-4 py-4 dark:border-purple-500/20">
        <h2 className="font-brand text-xl font-bold text-slate-700 dark:text-slate-100">
          {t.messages.title}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t.messages.subtitle}
        </p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.messages.search}
          className="input-field mt-3"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
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
                className={`flex w-full items-center gap-3 border-b border-purple-50/80 px-4 py-3 text-left transition duration-300 dark:border-purple-500/10 ${
                  active
                    ? 'bg-gradient-to-r from-purple-50/90 via-pink-50/70 to-orange-50/60 dark:from-purple-950/50 dark:via-pink-950/30 dark:to-orange-950/20'
                    : 'hover:bg-pink-50/50 dark:hover:bg-purple-950/25'
                }`}
              >
                <Avatar
                  src={chat.participantAvatar}
                  alt={chat.participantName}
                  size="md"
                  ring={active}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-700 dark:text-slate-100">
                        {chat.participantName}
                      </p>
                      <p className="truncate text-xs font-semibold text-pink-500">
                        @{chat.participantUsername}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                      {formatRelativeTime(chat.updatedAt, language)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {chat.lastMessage || '…'}
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
