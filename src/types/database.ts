export interface DbProfile {
  id: string
  email: string | null
  name: string
  breed: string
  age: number
  bio: string
  avatar_url: string
  created_at: string
  updated_at: string
}

export interface DbPost {
  id: string
  user_id: string
  image_url: string
  caption: string
  tags: string[]
  created_at: string
}

export interface DbComment {
  id: string
  post_id: string
  user_id: string
  body: string
  created_at: string
}

export interface DbLike {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

export interface DbMessage {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

export interface DbConversationMember {
  conversation_id: string
  user_id: string
}
