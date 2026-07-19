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
  const bottomRef = useRef<HTMLDivElement>(null)

  const conversation = conversations.find(
    (chat) => chat.id === activeConversationId,
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages.length])

  if (!conversation || !currentUser) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
        {t.messages.empty}
      </div>
    )
  }

  const handleSend = (event: FormEvent) => {
    event.preventDefault()
    const text = draft
    setDraft('')
    void sendMessage(conversation.id, text)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-white/70 px-4 py-3">
        <Avatar
          src={conversation.participantAvatar}
          alt={conversation.participantName}
          size="md"
          ring
        />
        <div>
          <p className="text-sm font-bold text-slate-700">
            {conversation.participantName}
          </p>
          <p className="text-xs font-medium text-emerald-600">{t.messages.online}</p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-transparent to-teal-50/20 px-4 py-4">
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
                    ? 'rounded-br-md bg-gradient-to-r from-teal-400 to-emerald-400 text-white'
                    : 'rounded-bl-md border border-white/80 bg-white/90 text-slate-700'
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
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-white/70 px-4 py-3"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t.messages.placeholder}
          className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-teal-300"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="btn-primary h-10 px-4"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">{t.messages.send}</span>
        </button>
      </form>
    </div>
  )
}
