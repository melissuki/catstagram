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
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-muted">
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
      <header className="flex items-center gap-3 border-b border-cream-deep px-4 py-3">
        <Avatar
          src={conversation.participantAvatar}
          alt={conversation.participantName}
          size="md"
          ring
        />
        <div>
          <p className="text-sm font-bold text-slate">
            {conversation.participantName}
          </p>
          <p className="text-xs text-success">{t.messages.online}</p>
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
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  mine
                    ? 'rounded-br-md bg-peach text-white'
                    : 'rounded-bl-md bg-cream-deep text-slate'
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
        className="flex items-center gap-2 border-t border-cream-deep px-4 py-3"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t.messages.placeholder}
          className="w-full rounded-2xl border border-cream-deep bg-cream-soft/70 px-3 py-2.5 text-sm outline-none focus:border-peach-soft"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="inline-flex h-10 items-center gap-2 rounded-2xl bg-peach px-4 text-sm font-bold text-white transition hover:bg-coral disabled:cursor-not-allowed disabled:bg-cream-deep disabled:text-slate-soft"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">{t.messages.send}</span>
        </button>
      </form>
    </div>
  )
}
