export type Language = 'en' | 'tr'

export type NotificationType = 'like' | 'comment' | 'follow' | 'message'

export interface CatProfile {
  id: string
  username: string
  name: string
  breed: string
  age: number
  bio: string
  avatar: string
  followers: number
  following: number
  postsCount: number
  gameHighScore: number
}

export interface Comment {
  id: string
  authorId: string
  authorName: string
  authorUsername: string
  authorAvatar: string
  text: string
  createdAt: string
}

export interface Post {
  id: string
  authorId: string
  authorName: string
  authorUsername: string
  authorAvatar: string
  image: string
  caption: string
  tags: string[]
  likes: number
  likedByMe: boolean
  comments: Comment[]
  createdAt: string
}

export interface Story {
  id: string
  authorId: string
  authorUsername: string
  authorName: string
  authorAvatar: string
  mediaUrl: string
  createdAt: string
  viewed: boolean
}

/** One ring in the stories bar — latest story + all active items for that author. */
export interface StoryRing {
  authorId: string
  authorUsername: string
  authorName: string
  authorAvatar: string
  items: Story[]
  hasUnviewed: boolean
}

export interface Message {
  id: string
  senderId: string
  receiverId: string
  text: string
  createdAt: string
}

/** One DM thread keyed by the other user's profile id. */
export interface Conversation {
  id: string
  participantId: string
  participantUsername: string
  participantName: string
  participantAvatar: string
  lastMessage: string
  updatedAt: string
  unread: number
  messages: Message[]
}

export interface AppNotification {
  id: string
  recipientId: string
  actorId: string
  actorName: string
  actorUsername: string
  actorAvatar: string
  type: NotificationType
  postId: string | null
  conversationId: string | null
  body: string
  isRead: boolean
  createdAt: string
}
