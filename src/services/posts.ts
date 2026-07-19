import { requireSupabase } from '@/services/supabaseClient'
import { extractTags, mapComment, mapPost } from '@/services/mappers'
import { uploadPostImage } from '@/services/storage'
import { createNotification } from '@/services/notifications'
import { sanitizeUserText } from '@/utils/sanitize'
import type { Comment, Post } from '@/types'
import type { DbComment, DbPost, DbProfile } from '@/types/database'

type AuthorFields = Pick<DbProfile, 'id' | 'name' | 'avatar_url' | 'username'>

type PostRow = DbPost & {
  profiles: AuthorFields | null
  likes: { user_id: string }[] | null
  comments:
    | (DbComment & {
        profiles: AuthorFields | null
      })[]
    | null
}

function toUiPost(row: PostRow, currentUserId: string | null): Post {
  const likes = row.likes ?? []
  const comments = (row.comments ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    .map((comment) => mapComment(comment, comment.profiles))

  return mapPost(
    row,
    row.profiles,
    {
      count: likes.length,
      likedByMe: currentUserId
        ? likes.some((like) => like.user_id === currentUserId)
        : false,
    },
    comments,
  )
}

const postSelect = `
  id,
  user_id,
  image_url,
  caption,
  tags,
  created_at,
  profiles:user_id (
    id,
    name,
    username,
    avatar_url
  ),
  likes (
    user_id
  ),
  comments (
    id,
    post_id,
    user_id,
    body,
    created_at,
    profiles:user_id (
      id,
      name,
      username,
      avatar_url
    )
  )
`

/**
 * Global discovery feed: all public posts, newest first.
 * Follow status is applied in the UI (badge / Follow button), not as a hard filter.
 */
export async function fetchFeed(currentUserId: string | null): Promise<Post[]> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('posts')
    .select(postSelect)
    .order('created_at', { ascending: false })
    .limit(60)

  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as PostRow[]).map((row) =>
    toUiPost(row, currentUserId),
  )
}

export async function fetchUserPosts(
  userId: string,
  currentUserId: string | null,
): Promise<Post[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('posts')
    .select(postSelect)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as PostRow[]).map((row) =>
    toUiPost(row, currentUserId),
  )
}

export async function createPost(input: {
  userId: string
  file: File
  caption: string
}): Promise<Post> {
  const supabase = requireSupabase()
  const imageUrl = await uploadPostImage(input.userId, input.file)
  const caption = sanitizeUserText(input.caption, 2000)
  const tags = extractTags(caption)

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: input.userId,
      image_url: imageUrl,
      caption,
      tags,
    })
    .select(postSelect)
    .single()

  if (error) throw new Error(error.message)
  return toUiPost(data as unknown as PostRow, input.userId)
}

async function getPostAuthorId(postId: string): Promise<string | null> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('posts')
    .select('user_id')
    .eq('id', postId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.user_id as string | undefined) ?? null
}

export async function toggleLike(
  postId: string,
  userId: string,
  currentlyLiked: boolean,
): Promise<void> {
  const supabase = requireSupabase()

  if (currentlyLiked) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase.from('likes').insert({
    post_id: postId,
    user_id: userId,
  })
  if (error) throw new Error(error.message)

  // Notify post author (skip self-likes)
  const authorId = await getPostAuthorId(postId)
  if (authorId && authorId !== userId) {
    await createNotification({
      userId: authorId,
      actorId: userId,
      type: 'like',
      postId,
    })
  }
}

export async function addComment(
  postId: string,
  userId: string,
  text: string,
): Promise<Comment> {
  const supabase = requireSupabase()
  const body = sanitizeUserText(text, 1000)
  if (!body) throw new Error('Comment is empty')
  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      user_id: userId,
      body,
    })
    .select(
      `
      id,
      post_id,
      user_id,
      body,
      created_at,
      profiles:user_id (
        id,
        name,
        username,
        avatar_url
      )
    `,
    )
    .single()

  if (error) throw new Error(error.message)

  const row = data as unknown as DbComment & {
    profiles: AuthorFields | null
  }

  const authorId = await getPostAuthorId(postId)
  if (authorId && authorId !== userId) {
    await createNotification({
      userId: authorId,
      actorId: userId,
      type: 'comment',
      postId,
      body,
    })
  }

  return mapComment(row, row.profiles)
}
