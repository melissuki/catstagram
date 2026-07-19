import type {
  AppNotification,
  CatProfile,
  Comment,
  Conversation,
  Message,
  Post,
} from '@/types'
import type {
  DbComment,
  DbMessage,
  DbNotification,
  DbPost,
  DbProfile,
} from '@/types/database'
import { resolveUsername } from '@/utils/username'

export function mapProfile(
  profile: DbProfile,
  counts: { followers?: number; following?: number; postsCount?: number } = {},
): CatProfile {
  return {
    id: profile.id,
    username: resolveUsername(profile.username, profile.id),
    name: profile.name,
    breed: profile.breed,
    age: profile.age,
    bio: profile.bio,
    avatar: profile.avatar_url || '',
    followers: counts.followers ?? 0,
    following: counts.following ?? 0,
    postsCount: counts.postsCount ?? 0,
    gameHighScore: profile.game_high_score ?? 0,
  }
}

export function extractTags(caption: string): string[] {
  const matches = caption.match(/#[\p{L}\p{N}_]+/gu) ?? []
  return [...new Set(matches.map((tag) => tag.toLowerCase()))]
}

export function mapComment(
  comment: DbComment,
  author?: Pick<DbProfile, 'id' | 'name' | 'avatar_url' | 'username'> | null,
): Comment {
  const authorId = author?.id ?? comment.user_id
  return {
    id: comment.id,
    authorId,
    authorName: author?.name ?? 'Cat',
    authorUsername: resolveUsername(author?.username, authorId),
    authorAvatar: author?.avatar_url ?? '',
    text: comment.body,
    createdAt: comment.created_at,
  }
}

export function mapPost(
  post: DbPost,
  author: Pick<DbProfile, 'id' | 'name' | 'avatar_url' | 'username'> | null | undefined,
  likes: { count: number; likedByMe: boolean },
  comments: Comment[],
): Post {
  const authorId = author?.id ?? post.user_id
  return {
    id: post.id,
    authorId,
    authorName: author?.name ?? 'Cat',
    authorUsername: resolveUsername(author?.username, authorId),
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
    receiverId: message.receiver_id,
    text: message.content ?? '',
    createdAt: message.created_at,
  }
}

export function mapConversation(params: {
  participant: CatProfile
  messages: Message[]
}): Conversation {
  const last = params.messages[params.messages.length - 1]
  return {
    id: params.participant.id,
    participantId: params.participant.id,
    participantUsername: params.participant.username,
    participantName: params.participant.name,
    participantAvatar: params.participant.avatar,
    lastMessage: last?.text ?? '',
    updatedAt: last?.createdAt ?? new Date().toISOString(),
    unread: 0,
    messages: params.messages,
  }
}

export function mapNotification(
  row: DbNotification,
  actor?: Pick<DbProfile, 'id' | 'name' | 'avatar_url' | 'username'> | null,
): AppNotification {
  const actorId = actor?.id ?? row.actor_id
  return {
    id: row.id,
    recipientId: row.user_id,
    actorId,
    // profiles.name is the cat display name (no cat_name column)
    actorName: actor?.name ?? 'Cat',
    actorUsername: resolveUsername(actor?.username, actorId),
    actorAvatar: actor?.avatar_url ?? '',
    type: row.type,
    postId: row.post_id,
    conversationId: row.conversation_id ?? null,
    body: row.body ?? '',
    isRead: row.is_read,
    createdAt: row.created_at,
  }
}
