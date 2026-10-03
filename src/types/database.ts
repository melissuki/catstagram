export interface DbProfile {
  id: string
  // Güvenlik (VULN-04): e-posta artık profiles tablosunda tutulmuyor;
  // kimlik e-postası auth.users içinde güvende. UI e-postayı profilden
  // okumaz.
  username: string
  name: string
  breed: string
  age: number
  bio: string
  avatar_url: string
  game_high_score: number
  coins: number
  post_streak_count: number
  post_streak_last_date: string | null
  login_streak_count: number
  avatar_config: unknown
  created_at: string
  updated_at: string
}

export interface DbDailyReward {
  id: string
  user_id: string
  reward_date: string
  streak_day: number
  coins_awarded: number
  post_id: string | null
  created_at: string
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

export interface DbShopItem {
  id: string
  key: string
  category: string
  price: number
  sprite_key: string
  is_active: boolean
  created_at: string
}

export interface DbInventoryItem {
  id: string
  user_id: string
  item_id: string
  acquired_at: string
}
