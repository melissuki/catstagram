import { requireSupabase } from '@/services/supabaseClient'
import {
  extractTags,
  mapComment,
  mapPost,
  mapStoriesFromPosts,
} from '@/services/mappers'
import { uploadPostImage } from '@/services/storage'
import type { Comment, Post, Story } from '@/types'
import type { DbComment, DbPost, DbProfile } from '@/types/database'

type PostRow = DbPost & {
  profiles: Pick<DbProfile, 'id' | 'name' | 'avatar_url'> | null
  likes: { user_id: string }[] | null
  comments:
    | (DbComment & {
        profiles: Pick<DbProfile, 'id' | 'name' | 'avatar_url'> | null
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
      avatar_url
    )
  )
`

export async function fetchFeed(currentUserId: string | null): Promise<Post[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('posts')
    .select(postSelect)
    .order('created_at', { ascending: false })

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

export async function fetchStories(
  currentUserId: string,
): Promise<Story[]> {
  const posts = await fetchFeed(currentUserId)
  return mapStoriesFromPosts(posts, currentUserId)
}

export async function createPost(input: {
  userId: string
  file: File
  caption: string
}): Promise<Post> {
  const supabase = requireSupabase()
  const imageUrl = await uploadPostImage(input.userId, input.file)
  const tags = extractTags(input.caption)

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: input.userId,
      image_url: imageUrl,
      caption: input.caption.trim(),
      tags,
    })
    .select(postSelect)
    .single()

  if (error) throw new Error(error.message)
  return toUiPost(data as unknown as PostRow, input.userId)
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
}

export async function addComment(
  postId: string,
  userId: string,
  text: string,
): Promise<Comment> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      user_id: userId,
      body: text.trim(),
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
        avatar_url
      )
    `,
    )
    .single()

  if (error) throw new Error(error.message)

  const row = data as unknown as DbComment & {
    profiles: Pick<DbProfile, 'id' | 'name' | 'avatar_url'> | null
  }

  return mapComment(row, row.profiles)
}
