import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import * as api from '@/services/api'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import type { AppNotification } from '@/types'

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
    language,
  } = useApp()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const seenToastIds = useRef(new Set<string>())
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    if (!currentUser || !isSupabaseConfigured) return

    const openFromNotification = async (item: AppNotification) => {
      closeNotifications()
      if (item.type === 'message') {
        await startChatWith(item.actorId)
        navigate('/messages')
        return
      }
      navigate(`/profile/${item.actorId}`)
    }

    const showToast = (item: AppNotification) => {
      if (seenToastIds.current.has(item.id)) return
      seenToastIds.current.add(item.id)
      if (seenToastIds.current.size > 80) {
        const first = seenToastIds.current.values().next().value as string
        seenToastIds.current.delete(first)
      }

      toast.info(toastCopy(item, tRef.current), {
        toastId: item.id,
        position: 'top-right',
        autoClose: 5000,
        onClick: () => {
          void openFromNotification(item)
        },
      })
    }

    const unsubNotifications = api.subscribeToNotifications(
      currentUser.id,
      () => {
        void refreshNotifications()
      },
      (notificationId) => {
        void api.fetchNotificationById(notificationId).then((item) => {
          if (item) showToast(item)
        })
      },
    )

    // Message-channel fallback: toast if a peer DM arrives even when
    // notification insert is unavailable (migration not applied yet).
    const unsubMessages = api.subscribeToAllMessages(currentUser.id, (message) => {
      if (message.senderId === currentUser.id) return
      void refreshChats({ silent: true })

      void (async () => {
        // Avoid double toast when a message notification also arrives.
        await new Promise((r) => window.setTimeout(r, 400))
        const recent = await api.fetchNotifications(currentUser.id)
        const matched = recent.find(
          (n) =>
            n.type === 'message' &&
            n.actorId === message.senderId &&
            Math.abs(
              new Date(n.createdAt).getTime() -
                new Date(message.createdAt).getTime(),
            ) < 5000,
        )
        if (matched) return

        const username = await api.fetchActorUsername(message.senderId)
        const fallbackId = `msg-${message.id}`
        if (seenToastIds.current.has(fallbackId)) return
        seenToastIds.current.add(fallbackId)

        const preview = message.text.slice(0, 80)
        toast.info(
          `💬 ${tRef.current.notifications.toastMessage} @${username}: ${preview}`,
          {
            toastId: fallbackId,
            position: 'top-right',
            autoClose: 5000,
            onClick: () => {
              void startChatWith(message.senderId).then(() =>
                navigate('/messages'),
              )
            },
          },
        )
        void refreshNotifications()
      })()
    })

    return () => {
      unsubNotifications()
      unsubMessages()
    }
  }, [
    currentUser,
    refreshNotifications,
    refreshChats,
    startChatWith,
    closeNotifications,
    navigate,
    language,
  ])

  return null
}
