import type { MamaStreak } from '@/types'

export const STREAK_STORAGE_KEY = 'catstagram_mama_streak'

function toDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

function yesterdayKey(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return toDateKey(date)
}

export function createDefaultStreak(): MamaStreak {
  return {
    count: 0,
    lastFedDate: null,
    fedToday: false,
  }
}

export function hydrateStreak(raw: MamaStreak | null): MamaStreak {
  if (!raw) return createDefaultStreak()

  const today = toDateKey()
  const yesterday = yesterdayKey()

  if (raw.lastFedDate === today) {
    return { ...raw, fedToday: true }
  }

  if (raw.lastFedDate === yesterday) {
    return { ...raw, fedToday: false }
  }

  // Missed a day — reset the streak counter but keep history date.
  return {
    count: 0,
    lastFedDate: raw.lastFedDate,
    fedToday: false,
  }
}

export function loadStreakFromStorage(): MamaStreak {
  try {
    const stored = localStorage.getItem(STREAK_STORAGE_KEY)
    if (!stored) return createDefaultStreak()
    return hydrateStreak(JSON.parse(stored) as MamaStreak)
  } catch {
    return createDefaultStreak()
  }
}

export function saveStreakToStorage(streak: MamaStreak): void {
  localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(streak))
}

export function markFedToday(current: MamaStreak): MamaStreak {
  const today = toDateKey()
  if (current.lastFedDate === today) {
    return { ...current, fedToday: true }
  }

  const nextCount =
    current.lastFedDate === yesterdayKey() ? current.count + 1 : 1

  return {
    count: nextCount,
    lastFedDate: today,
    fedToday: true,
  }
}
