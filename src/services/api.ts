/**
 * Central API facade for Catstagram.
 * Backed by Supabase (Auth, Postgres, Storage, Realtime).
 * Kept as a thin layer so pages/context stay framework-agnostic.
 */
export {
  supabase,
  isSupabaseConfigured,
  requireSupabase,
} from '@/services/supabaseClient'

export {
  signUp,
  signIn,
  signOut,
  getSessionUserId,
  resetPasswordForEmail,
  updatePassword,
  type SignUpInput,
  type SignInInput,
  type SignUpResult,
} from '@/services/auth'

export {
  fetchProfileById,
  fetchProfileByUsername,
  searchProfilesByUsername,
  isUsernameAvailable,
  updateMyProfile,
  updateGameHighScore,
  fetchSuggestedCats,
  fetchFollowingIds,
  toggleFollow,
} from '@/services/profiles'

export {
  fetchNotifications,
  fetchNotificationById,
  markNotificationsRead,
  createNotification,
  subscribeToNotifications,
  fetchActorUsername,
} from '@/services/notifications'

export {
  fetchFeed,
  fetchUserPosts,
  createPost,
  toggleLike,
  addComment,
} from '@/services/posts'

export {
  fetchStories,
  createStory,
  markStoriesViewed,
  groupStoriesIntoRings,
} from '@/services/stories'

export { uploadStoryImage } from '@/services/storage'

export {
  fetchConversations,
  fetchThread,
  getOrCreateConversation,
  ensureConversation,
  sendMessage,
  subscribeToMessages,
  subscribeToAllMessages,
  subscribeToFeed,
} from '@/services/messages'

export { uploadAvatar, uploadPostImage } from '@/services/storage'
