import { requireSupabase } from '@/services/supabaseClient'
import { uploadStoryImage } from '@/services/storage'
import type { DbProfile, DbStory } from '@/types/database'
import type { Story, StoryRing } from '@/types'
import { resolveUsername } from '@/utils/username'

const STORY_TTL_MS = 24 * 60 * 60 * 1000
const VIEWED_STORAGE_KEY = 'catstagram_viewed_stories'

type StoryRow = DbStory & {
  author: Pick<DbProfile, 'id' | 'name' | 'avatar_url' | 'username'> | null
}

function loadViewedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(VIEWED_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveViewedIds(ids: Set<string>) {
  const trimmed = [...ids].slice(-200)
  localStorage.setItem(VIEWED_STORAGE_KEY, JSON.stringify(trimmed))
}

export function markStoriesViewed(storyIds: string[]) {
  if (!storyIds.length) return
  const viewed = loadViewedIds()
  for (const id of storyIds) viewed.add(id)
  saveViewedIds(viewed)
}

function mapStory(row: StoryRow, viewed: Set<string>): Story {
  const authorId = row.author?.id ?? row.user_id
  return {
    id: row.id,
    authorId,
    authorUsername: resolveUsername(row.author?.username, authorId),
    authorName: row.author?.name ?? 'Cat',
    authorAvatar: row.author?.avatar_url ?? '',
    mediaUrl: row.media_url,
    createdAt: row.created_at,
    viewed: viewed.has(row.id),
  }
}

/** Active stories from the last 24h, newest first. */
export async function fetchStories(_currentUserId: string): Promise<Story[]> {
  const supabase = requireSupabase()
  const since = new Date(Date.now() - STORY_TTL_MS).toISOString()
  const viewed = loadViewedIds()

  const { data, error } = await supabase
    .from('stories')
    .select(
      `
      id,
      user_id,
      media_url,
      created_at,
      author:profiles!user_id (
        id,
        name,
        avatar_url,
        username
      )
    `,
    )
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(80)

  if (error) throw new Error(error.message)

  return ((data ?? []) as unknown as StoryRow[]).map((row) =>
    mapStory(row, viewed),
  )
}

/** Group flat stories into Instagram-style rings (one per author). */
export function groupStoriesIntoRings(
  stories: Story[],
  currentUserId: string,
): {
  own: StoryRing | null
  friends: StoryRing[]
} {
  const byAuthor = new Map<string, Story[]>()

  for (const story of stories) {
    const list = byAuthor.get(story.authorId) ?? []
    list.push(story)
    byAuthor.set(story.authorId, list)
  }

  const toRing = (authorId: string, items: Story[]): StoryRing => {
    const sorted = [...items].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    const first = sorted[0]
    return {
      authorId,
      authorUsername: first.authorUsername,
      authorName: first.authorName,
      authorAvatar: first.authorAvatar,
      items: sorted,
      hasUnviewed: sorted.some((s) => !s.viewed),
    }
  }

  const ownItems = byAuthor.get(currentUserId) ?? []
  const own = ownItems.length
    ? toRing(currentUserId, ownItems)
    : null

  const friends = [...byAuthor.entries()]
    .filter(([id]) => id !== currentUserId)
    .map(([id, items]) => toRing(id, items))
    .sort((a, b) => {
      if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1
      const aLatest = a.items[a.items.length - 1]?.createdAt ?? ''
      const bLatest = b.items[b.items.length - 1]?.createdAt ?? ''
      return new Date(bLatest).getTime() - new Date(aLatest).getTime()
    })

  return { own, friends }
}

export async function createStory(input: {
  userId: string
  file: File
}): Promise<Story> {
  const supabase = requireSupabase()
  const mediaUrl = await uploadStoryImage(input.file)

  const { data, error } = await supabase
    .from('stories')
    .insert({
      user_id: input.userId,
      media_url: mediaUrl,
    })
    .select(
      `
      id,
      user_id,
      media_url,
      created_at,
      author:profiles!user_id (
        id,
        name,
        avatar_url,
        username
      )
    `,
    )
    .single()

  if (error) throw new Error(error.message)

  return mapStory(data as unknown as StoryRow, loadViewedIds())
}
