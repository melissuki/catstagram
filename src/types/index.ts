export type Language = 'en' | 'tr'

export interface CatProfile {
  id: string
  name: string
  breed: string
  age: number
  bio: string
  avatar: string
  followers: number
  following: number
  postsCount: number
}

export interface Comment {
  id: string
  authorId: string
  authorName: string
  authorAvatar: string
  text: string
  createdAt: string
}

export interface Post {
  id: string
  authorId: string
  authorName: string
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
  authorName: string
  authorAvatar: string
  viewed: boolean
}

export interface Message {
  id: string
  senderId: string
  text: string
  createdAt: string
}

export interface Conversation {
  id: string
  participantId: string
  participantName: string
  participantAvatar: string
  lastMessage: string
  updatedAt: string
  unread: number
  messages: Message[]
}

export interface MamaStreak {
  count: number
  lastFedDate: string | null
  fedToday: boolean
}
