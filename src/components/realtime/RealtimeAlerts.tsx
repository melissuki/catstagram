import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import * as api from '@/services/api'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import type { AppNotification } from '@/types'
import { showDesktopNotification } from '@/utils/desktopNotifications'

function toastCopy(item: AppNotification, t: ReturnType<typeof useTranslation>['t']) {
  const handle = `@${item.actorUsername}`
  if (item.type === 'message') {
    const preview = item.body.trim()
    return preview
      ? `💬 ${t.notifications.toastMessage} ${handle}: ${preview}`
      : `💬 ${t.notifications.toastMessage} ${handle}`
  }
  if (item.type === 'like') {
    return `❤️ ${handle} ${t.notifications.liked}`
  }
  if (item.type === 'comment') {
    const preview = item.body.trim()
    return preview
      ? `💬 ${handle} ${t.notifications.commented} ${preview}`
      : `💬 ${handle} ${t.notifications.commented}`
  }
  return `🐾 ${handle} ${t.notifications.followed}`
}

/**
 * Global Realtime → Toastify bridge for notifications (+ message inserts as fallback).
 * Mount once inside the authenticated layout.
 */
export function RealtimeAlerts() {
  const {
    currentUser,
    refreshNotifications,
    refreshChats,
    startChatWith,
    closeNotifications,
  } = useApp()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const seenToastIds = useRef(new Set<string>())
  const userId = currentUser?.id ?? null

  // Latest callbacks in a ref: the subscriptions below depend only on the
  // user id, so profile refreshes (coins, streaks) don't tear them down.
  const live = useRef({ t, refreshNotifications, refreshChats, startChatWith, closeNotifications, navigate })
  live.current = { t, refreshNotifications, refreshChats, startChatWith, closeNotifications, navigate }

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return

    const markSeen = (id: string) => {
      if (seenToastIds.current.has(id)) return false
      seenToastIds.current.add(id)
      if (seenToastIds.current.size > 80) {
        const first = seenToastIds.current.values().next().value as string
        seenToastIds.current.delete(first)
      }
      return true
    }

    const openChat = async (peerId: string) => {
      live.current.closeNotifications()
      await live.current.startChatWith(peerId)
      live.current.navigate('/messages')
    }

    const openFromNotification = async (item: AppNotification) => {
      if (item.type === 'message') {
        await openChat(item.actorId)
        return
      }
      live.current.closeNotifications()
      live.current.navigate(`/profile/${item.actorId}`)
    }

    const alert = (id: string, text: string, onClick: () => void) => {
      if (!markSeen(id)) return
      toast.info(text, {
        toastId: id,
        position: 'top-right',
        autoClose: 5000,
        onClick,
      })
      // Also show it in the computer's notification area when the tab
      // is in the background (needs the user's permission).
      showDesktopNotification({ title: 'Catstagram', body: text, tag: id, onClick })
    }

    const unsubNotifications = api.subscribeToNotifications(
      userId,
      () => {
        void live.current.refreshNotifications()
      },
      (notificationId) => {
        void api.fetchNotificationById(notificationId).then((item) => {
          if (item) {
            alert(item.id, toastCopy(item, live.current.t), () => {
              void openFromNotification(item)
            })
          }
        })
      },
    )

    // Message-channel fallback: alert if a peer DM arrives but no matching
    // notification row shows up (e.g. the notification insert failed).
    const unsubMessages = api.subscribeToAllMessages(userId, (message) => {
      if (message.senderId === userId) return
      void live.current.refreshChats({ silent: true })

      void (async () => {
        await new Promise((r) => window.setTimeout(r, 1500))
        const recent = await api.fetchNotifications(userId)
        const matched = recent.find(
          (n) =>
            n.type === 'message' &&
            n.actorId === message.senderId &&
            Math.abs(
              new Date(n.createdAt).getTime() -
                new Date(message.createdAt).getTime(),
            ) < 10000,
        )
        if (matched) {
          // Realtime for notifications may have been missed; alert once.
          alert(matched.id, toastCopy(matched, live.current.t), () => {
            void openChat(message.senderId)
          })
          return
        }

        const username = await api.fetchActorUsername(message.senderId)
        const preview = message.text.slice(0, 80)
        alert(
          `msg-${message.id}`,
          `💬 ${live.current.t.notifications.toastMessage} @${username}: ${preview}`,
          () => {
            void openChat(message.senderId)
          },
        )
        void live.current.refreshNotifications()
      })()
    })

    return () => {
      unsubNotifications()
      unsubMessages()
    }
  }, [userId])

  return null
}
