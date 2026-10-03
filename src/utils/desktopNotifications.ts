/**
 * Operating-system notifications (the ones that appear in the corner of the
 * computer screen) while Catstagram is open in a browser tab.
 *
 * Works in Chrome, Edge, Firefox and Safari on desktop as long as the tab is
 * open, even in the background. Notifications while the site is fully closed
 * need Web Push + a service worker, which is a separate step.
 */

export type DesktopPermission = NotificationPermission | 'unsupported'

const DISMISS_KEY = 'catstagram_desktop_notif_prompt_dismissed'

export function desktopNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getDesktopPermission(): DesktopPermission {
  if (!desktopNotificationsSupported()) return 'unsupported'
  return Notification.permission
}

/** Must be called from a click handler (browsers require a user gesture). */
export async function requestDesktopPermission(): Promise<DesktopPermission> {
  if (!desktopNotificationsSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export function isPromptDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissPrompt(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // Private mode etc. The banner simply shows again next time.
  }
}

/**
 * Shows a system notification when the user is not looking at the tab.
 * When the tab is visible and focused, the in-app toast is enough.
 */
export function showDesktopNotification(options: {
  title: string
  body: string
  tag: string
  onClick?: () => void
}): void {
  if (getDesktopPermission() !== 'granted') return
  if (document.visibilityState === 'visible' && document.hasFocus()) return

  try {
    const notification = new Notification(options.title, {
      body: options.body.slice(0, 180),
      tag: options.tag,
      icon: '/favicon.svg',
    })
    notification.onclick = () => {
      window.focus()
      options.onClick?.()
      notification.close()
    }
  } catch (error) {
    // Some mobile browsers only allow notifications from a service worker.
    console.warn('[notifications] desktop notification failed', error)
  }
}
