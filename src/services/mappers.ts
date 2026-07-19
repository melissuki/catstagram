import type { CatProfile, Comment, Conversation, Message, Post, Story } from '@/types'
import type { DbComment, DbMessage, DbPost, DbProfile } from '@/types/database'

export function mapProfile(
  profile: DbProfile,
  counts: { followers?: number; following?: number; postsCount?: number } = {},
): CatProfile {
  return {
    id: profile.id,
    name: profile.name,
    breed: profile.breed,
    age: profile.age,
    bio: profile.bio,
    avatar: profile.avatar_url || '',
    followers: counts.followers ?? 0,
    following: counts.following ?? 0,
    postsCount: counts.postsCount ?? 0,
  }
}

export function extractTags(caption: string): string[] {
  const matches = caption.match(/#[\p{L}\p{N}_]+/gu) ?? []
  return [...new Set(matches.map((tag) => tag.toLowerCase()))]
}

export function mapComment(
  comment: DbComment,
  author?: Pick<DbProfile, 'id' | 'name' | 'avatar_url'> | null,
): Comment {
  return {
    id: comment.id,
    authorId: comment.user_id,
    authorName: author?.name ?? 'Cat',
    authorAvatar: author?.avatar_url ?? '',
    text: comment.body,
    createdAt: comment.created_at,
  }
}

export function mapPost(
  post: DbPost,
  author: Pick<DbProfile, 'id' | 'name' | 'avatar_url'> | null | undefined,
  likes: { count: number; likedByMe: boolean },
  comments: Comment[],
): Post {
  return {
    id: post.id,
    authorId: post.user_id,
    authorName: author?.name ?? 'Cat',
    authorAvatar: author?.avatar_url ?? '',
    image: post.image_url,
    caption: post.caption,
    tags: post.tags ?? [],
    likes: likes.count,
    likedByMe: likes.likedByMe,
    comments,
    createdAt: post.created_at,
  }
}

export function mapMessage(message: DbMessage): Message {
  return {
    id: message.id,
    senderId: message.sender_id,
    text: message.body,
    createdAt: message.created_at,
  }
}

export function mapConversation(params: {
  id: string
  participant: CatProfile
  messages: Message[]
}): Conversation {
  const last = params.messages[params.messages.length - 1]
  return {
    id: params.id,
    participantId: params.participant.id,
    participantName: params.participant.name,
    participantAvatar: params.participant.avatar,
    lastMessage: last?.text ?? '',
    updatedAt: last?.createdAt ?? new Date().toISOString(),
    unread: 0,
    messages: params.messages,
  }
}

export function mapStoriesFromPosts(posts: Post[], currentUserId: string): Story[] {
  const seen = new Set<string>()
  const stories: Story[] = []

  for (const post of posts) {
    if (post.authorId === currentUserId || seen.has(post.authorId)) continue
    seen.add(post.authorId)
    stories.push({
      id: `story-${post.authorId}`,
      authorId: post.authorId,
      authorName: post.authorName,
      authorAvatar: post.authorAvatar,
      viewed: false,
    })
    if (stories.length >= 12) break
  }

  return stories
}
