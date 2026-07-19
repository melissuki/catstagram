/**
 * Central API facade for Catstagram.
 * Backed by Supabase (Auth, Postgres, Storage, Realtime).
 * Kept as a thin layer so pages/context stay framework-agnostic.
 */
export { isSupabaseConfigured } from '@/lib/supabase'

export {
  signUp,
  signIn,
  signOut,
  getSessionUserId,
  type SignUpInput,
  type SignInInput,
} from '@/services/auth'

export {
  fetchProfileById,
  updateMyProfile,
  fetchSuggestedCats,
  fetchFollowingIds,
  toggleFollow,
} from '@/services/profiles'

export {
  fetchFeed,
  fetchUserPosts,
  fetchStories,
  createPost,
  toggleLike,
  addComment,
} from '@/services/posts'

export {
  fetchConversations,
  getOrCreateConversation,
  sendMessage,
  subscribeToMessages,
  subscribeToFeed,
} from '@/services/messages'

export { uploadAvatar, uploadPostImage } from '@/services/storage'
