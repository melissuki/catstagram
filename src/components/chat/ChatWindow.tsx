import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { Avatar } from '@/components/common/Avatar'

export function ChatWindow() {
  const {
    conversations,
    activeConversationId,
    sendMessage,
    currentUser,
  } = useApp()
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const conversation = conversations.find(
    (chat) => chat.id === activeConversationId,
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages.length, activeConversationId])

  if (!conversation || !currentUser) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-b from-transparent via-pink-50/20 to-orange-50/20 px-6 text-center text-sm text-slate-500 dark:via-purple-950/20 dark:to-slate-950/40 dark:text-slate-400">
        {t.messages.empty}
      </div>
    )
  }

  const handleSend = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    setSending(true)
    try {
      // peer id === conversation.id / participantId
      await sendMessage(conversation.participantId, text)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-white/40 via-pink-50/20 to-orange-50/30 dark:from-slate-950/40 dark:via-purple-950/20 dark:to-slate-900/50">
      <header className="flex items-center gap-3 border-b border-purple-100/40 bg-gradient-to-r from-purple-50/80 via-pink-50/60 to-orange-50/50 px-4 py-3 dark:border-purple-500/20 dark:from-slate-950 dark:via-purple-950/40 dark:to-slate-900">
        <Avatar
          src={conversation.participantAvatar}
          alt={conversation.participantName}
          size="md"
          ring
        />
        <div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-100">
            {conversation.participantName}
          </p>
          <p className="text-xs font-semibold text-pink-500">
            @{conversation.participantUsername}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {conversation.messages.map((message) => {
          const mine = message.senderId === currentUser.id
          return (
            <div
              key={message.id}
              className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                  mine
                    ? 'rounded-br-md bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 text-white'
                    : 'rounded-bl-md border border-purple-100/50 bg-white/95 text-slate-700 dark:border-purple-500/20 dark:bg-slate-900/90 dark:text-slate-100'
                }`}
              >
                {message.text}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(event) => void handleSend(event)}
        className="flex items-center gap-2 border-t border-purple-100/40 bg-white/70 px-4 py-3 dark:border-purple-500/20 dark:bg-slate-950/60"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t.messages.placeholder}
          className="input-field"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="btn-primary h-10 px-4"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">{t.messages.send}</span>
        </button>
      </form>
    </div>
  )
}
