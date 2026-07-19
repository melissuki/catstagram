export interface DbProfile {
  id: string
  email: string | null
  username: string
  name: string
  breed: string
  age: number
  bio: string
  avatar_url: string
  food_streak: number
  last_fed_date: string | null
  game_high_score: number
  created_at: string
  updated_at: string
}

export interface DbNotification {
  id: string
  user_id: string
  actor_id: string
  type: 'like' | 'comment' | 'follow' | 'message'
  post_id: string | null
  conversation_id: string | null
  body: string
  is_read: boolean
  created_at: string
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

export interface DbStory {
  id: string
  user_id: string
  media_url: string
  created_at: string
}

export interface DbMessage {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
}

export interface DbConversationMember {
  conversation_id: string
  user_id: string
}
