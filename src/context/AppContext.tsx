import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  AppNotification,
  CatProfile,
  Conversation,
  Language,
  Message,
  Post,
  Story,
} from '@/types'
import { toast } from 'react-toastify'
import { isSupabaseConfigured, requireSupabase } from '@/services/supabaseClient'
import * as api from '@/services/api'
import { tryAction } from '@/utils/actionThrottle'
import { sanitizeUserText } from '@/utils/sanitize'
import { toUserFacingError } from '@/utils/userFacingError'
import { getTranslations } from '@/i18n/translations'

interface AppContextValue {
  isConfigured: boolean
  authReady: boolean
  language: Language
  setLanguage: (language: Language) => void
  isAuthenticated: boolean
  currentUser: CatProfile | null
  authModalOpen: boolean
  openAuthModal: () => void
  closeAuthModal: () => void
  /** Opens the auth gate when guest; returns true only when signed in. */
  requireAuth: () => boolean
  signUp: (input: api.SignUpInput) => Promise<api.SignUpResult>
  signIn: (input: api.SignInInput) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (updates: {
    name: string
    breed: string
    age: number
    bio: string
    username?: string
    avatarFile?: File | null
  }) => Promise<void>
  posts: Post[]
  stories: Story[]
  feedLoading: boolean
  feedError: string | null
  refreshFeed: (options?: { silent?: boolean }) => Promise<void>
  createPost: (file: File, caption: string) => Promise<void>
  createStory: (file: File) => Promise<void>
  markStoriesAsViewed: (storyIds: string[]) => void
  toggleLike: (postId: string) => Promise<void>
  addComment: (postId: string, text: string) => Promise<void>
  followingIds: string[]
  toggleFollow: (catId: string) => Promise<void>
  startChatWith: (friendId: string) => Promise<string>
  conversations: Conversation[]
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  /** Send a DM to a peer (peer user id, not a conversation uuid). */
  sendMessage: (peerId: string, text: string) => Promise<void>
  chatsLoading: boolean
  refreshChats: (options?: { silent?: boolean }) => Promise<void>
  notifications: AppNotification[]
  unreadNotificationCount: number
  refreshNotifications: () => Promise<void>
  markNotificationsAsRead: () => Promise<void>
  notificationsOpen: boolean
  openNotifications: () => void
  closeNotifications: () => void
  gameOpen: boolean
  openGame: () => void
  closeGame: () => void
  submitGameScore: (score: number) => Promise<{ isNewHigh: boolean }>
}

const AppContext = createContext<AppContextValue | null>(null)

const LANGUAGE_STORAGE_KEY = 'catstagram_language'

function loadLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return stored === 'tr' ? 'tr' : 'en'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(loadLanguage)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [currentUser, setCurrentUser] = useState<CatProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [followingIds, setFollowingIds] = useState<string[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null,
  )
  const [chatsLoading, setChatsLoading] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [gameOpen, setGameOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
  }, [])

  const openAuthModal = useCallback(() => setAuthModalOpen(true), [])
  const closeAuthModal = useCallback(() => setAuthModalOpen(false), [])
  const requireAuth = useCallback(() => {
    if (currentUser) return true
    setAuthModalOpen(true)
    return false
  }, [currentUser])

  const refreshFeed = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!isSupabaseConfigured) return
      const silent = options?.silent ?? false
      const userId = currentUser?.id ?? null
      if (!silent) {
        setFeedLoading(true)
        setFeedError(null)
      }
      try {
        const [feedData, following, storyResult] = await Promise.all([
          api.fetchFeed(userId),
          userId
            ? api.fetchFollowingIds(userId)
            : Promise.resolve([] as string[]),
          api.fetchStories(userId ?? '').catch((error) => {
            console.warn('[stories] unavailable — run add_stories.sql?', error)
            return [] as Story[]
          }),
        ])
        setPosts(feedData)
        setStories(storyResult)
        setFollowingIds(following)
      } catch (error) {
        console.error('[feed]', error)
        if (!silent) {
          const t = getTranslations(language)
          setFeedError(t.feed.error)
        }
      } finally {
        if (!silent) setFeedLoading(false)
      }
    },
    [currentUser, language],
  )

  const refreshChats = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!currentUser) return
      const silent = options?.silent ?? false
      if (!silent) setChatsLoading(true)
      try {
        const data = await api.fetchConversations(currentUser.id)
        setConversations(data)
      } catch (error) {
        console.error(error)
      } finally {
        if (!silent) setChatsLoading(false)
      }
    },
    [currentUser],
  )

  const bootstrapSession = useCallback(async (userId: string) => {
    const profile = await api.fetchProfileById(userId)
    setCurrentUser(profile)
  }, [])

  const refreshNotifications = useCallback(async () => {
    if (!currentUser) return
    try {
      const data = await api.fetchNotifications(currentUser.id)
      setNotifications(data)
    } catch (error) {
      console.warn(
        '[notifications] unavailable — run fix_notifications_user_id.sql?',
        error,
      )
    }
  }, [currentUser])

  const markNotificationsAsRead = useCallback(async () => {
    if (!currentUser) return
    const hadUnread = notifications.some((n) => !n.isRead)
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    try {
      await api.markNotificationsRead(currentUser.id)
    } catch (error) {
      console.error(error)
      if (hadUnread) void refreshNotifications()
    }
  }, [currentUser, notifications, refreshNotifications])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true)
      return
    }

    const supabase = requireSupabase()
    let mounted = true

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        if (data.session?.user) {
          await bootstrapSession(data.session.user.id)
        }
      } catch (error) {
        console.error(error)
      } finally {
        if (mounted) setAuthReady(true)
      }
    }

    void init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setCurrentUser(null)
        setConversations([])
        setFollowingIds([])
        setNotifications([])
        setNotificationsOpen(false)
        setGameOpen(false)
        setActiveConversationId(null)
        // Guest explore: keep public feed/stories available
        void api
          .fetchFeed(null)
          .then(setPosts)
          .catch((error) => console.error('[feed] guest reload', error))
        void api
          .fetchStories('')
          .then(setStories)
          .catch(() => setStories([]))
        return
      }
      void bootstrapSession(session.user.id)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [bootstrapSession])

  // Public explore feed for guests + authenticated users
  useEffect(() => {
    if (!authReady || !isSupabaseConfigured) return
    void refreshFeed()
    if (currentUser) {
      void refreshChats()
      void refreshNotifications()
    }
  }, [authReady, currentUser, refreshFeed, refreshChats, refreshNotifications])

  // Notification realtime is handled by RealtimeAlerts (toast + refresh).

  // Live global feed: posts / likes / comments via supabase.channel()
  useEffect(() => {
    if (!authReady || !isSupabaseConfigured) return
    return api.subscribeToFeed(() => {
      void refreshFeed({ silent: true })
    })
  }, [authReady, refreshFeed])

  // Load full chronological history whenever a peer thread is opened
  useEffect(() => {
    if (!currentUser || !activeConversationId || !isSupabaseConfigured) return
    let cancelled = false

    void (async () => {
      try {
        const next = await api.ensureConversation(
          currentUser.id,
          activeConversationId,
        )
        if (cancelled) return
        setConversations((prev) => {
          if (prev.some((chat) => chat.id === next.id)) {
            return prev.map((chat) => (chat.id === next.id ? next : chat))
          }
          return [next, ...prev]
        })
      } catch (error) {
        console.error('[messages] failed to load thread', error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeConversationId, currentUser])

  // Live chat thread for the open peer DM
  useEffect(() => {
    if (!currentUser || !activeConversationId || !isSupabaseConfigured) return

    return api.subscribeToMessages(
      activeConversationId,
      currentUser.id,
      (message: Message) => {
        setConversations((prev) =>
          prev.map((chat) => {
            if (chat.id !== activeConversationId) return chat
            if (chat.messages.some((item) => item.id === message.id)) return chat
            return {
              ...chat,
              messages: [...chat.messages, message],
              lastMessage: message.text,
              updatedAt: message.createdAt,
            }
          }),
        )
      },
    )
  }, [activeConversationId, currentUser])

  // Keep DM inbox previews in sync for all peers
  useEffect(() => {
    if (!currentUser || !isSupabaseConfigured) return

    return api.subscribeToAllMessages(currentUser.id, (message) => {
      const peerId =
        message.senderId === currentUser.id
          ? message.receiverId
          : message.senderId

      setConversations((prev) => {
        const exists = prev.some((chat) => chat.id === peerId)
        if (!exists) {
          void refreshChats({ silent: true })
          return prev
        }

        return prev
          .map((chat) => {
            if (chat.id !== peerId) return chat
            if (chat.messages.some((item) => item.id === message.id)) return chat
            return {
              ...chat,
              messages: [...chat.messages, message],
              lastMessage: message.text,
              updatedAt: message.createdAt,
            }
          })
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          )
      })
    })
  }, [currentUser, refreshChats])

  const signUp = useCallback(async (input: api.SignUpInput) => {
    // Never auto-login after signup — email must be verified first.
    return api.signUp(input)
  }, [])

  const signIn = useCallback(async (input: api.SignInInput) => {
    const profile = await api.signIn(input)
    setCurrentUser(profile)
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    await api.resetPasswordForEmail(email)
  }, [])

  const updatePassword = useCallback(async (newPassword: string) => {
    await api.updatePassword(newPassword)
  }, [])

  const logout = useCallback(async () => {
    await api.signOut()
    setCurrentUser(null)
    setFollowingIds([])
    setConversations([])
    setNotifications([])
    setNotificationsOpen(false)
    setGameOpen(false)
    setActiveConversationId(null)
    void refreshFeed({ silent: true })
  }, [refreshFeed])

  const updateProfile = useCallback(
    async (updates: {
      name: string
      breed: string
      age: number
      bio: string
      username?: string
      avatarFile?: File | null
    }) => {
      if (!currentUser) return
      const next = await api.updateMyProfile(currentUser.id, {
        ...updates,
        name: sanitizeUserText(updates.name, 80),
        breed: sanitizeUserText(updates.breed, 80),
        bio: sanitizeUserText(updates.bio, 500),
      })
      setCurrentUser(next)
    },
    [currentUser],
  )

  const createPost = useCallback(
    async (file: File, caption: string) => {
      if (!requireAuth()) return
      if (!currentUser) return
      const post = await api.createPost({
        userId: currentUser.id,
        file,
        caption: sanitizeUserText(caption, 2000),
      })
      setPosts((prev) => [post, ...prev])
    },
    [currentUser, requireAuth],
  )

  const createStory = useCallback(
    async (file: File) => {
      if (!requireAuth()) return
      if (!currentUser) return
      const story = await api.createStory({
        userId: currentUser.id,
        file,
      })
      setStories((prev) => [story, ...prev.filter((s) => s.id !== story.id)])
    },
    [currentUser, requireAuth],
  )

  const markStoriesAsViewed = useCallback((storyIds: string[]) => {
    if (!storyIds.length) return
    api.markStoriesViewed(storyIds)
    setStories((prev) =>
      prev.map((story) =>
        storyIds.includes(story.id) ? { ...story, viewed: true } : story,
      ),
    )
  }, [])

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!requireAuth()) return
      if (!currentUser) return
      const t = getTranslations(language)
      if (!tryAction(`like:${currentUser.id}:${postId}`)) {
        toast.info(t.auth.slowDown)
        return
      }
      const target = posts.find((post) => post.id === postId)
      if (!target) return

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                likedByMe: !post.likedByMe,
                likes: post.likedByMe
                  ? Math.max(0, post.likes - 1)
                  : post.likes + 1,
              }
            : post,
        ),
      )

      try {
        await api.toggleLike(postId, currentUser.id, target.likedByMe)
      } catch (error) {
        setPosts((prev) =>
          prev.map((post) => (post.id === postId ? target : post)),
        )
        toast.error(toUserFacingError(error, t.auth.authFailed))
      }
    },
    [currentUser, posts, requireAuth, language],
  )

  const addComment = useCallback(
    async (postId: string, text: string) => {
      if (!requireAuth()) return
      if (!currentUser) return
      const clean = sanitizeUserText(text, 1000)
      if (!clean) return
      const t = getTranslations(language)
      if (!tryAction(`comment:${currentUser.id}:${postId}`)) {
        toast.info(t.auth.slowDown)
        return
      }
      try {
        const comment = await api.addComment(postId, currentUser.id, clean)
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? { ...post, comments: [...post.comments, comment] }
              : post,
          ),
        )
      } catch (error) {
        toast.error(toUserFacingError(error, t.auth.authFailed))
      }
    },
    [currentUser, requireAuth, language],
  )

  const toggleFollow = useCallback(
    async (catId: string) => {
      if (!requireAuth()) return
      if (!currentUser) return
      const t = getTranslations(language)
      if (!tryAction(`follow:${currentUser.id}:${catId}`)) {
        toast.info(t.auth.slowDown)
        return
      }
      try {
        const isFollowing = await api.toggleFollow(currentUser.id, catId)
        setFollowingIds((prev) =>
          isFollowing
            ? [...prev, catId]
            : prev.filter((id) => id !== catId),
        )
        void refreshFeed({ silent: true })
        void api.fetchProfileById(currentUser.id).then(setCurrentUser)
      } catch (error) {
        toast.error(toUserFacingError(error, t.auth.authFailed))
      }
    },
    [currentUser, refreshFeed, requireAuth, language],
  )

  const startChatWith = useCallback(
    async (friendId: string) => {
      if (!requireAuth()) throw new Error('AUTH_REQUIRED')
      if (!currentUser) throw new Error('AUTH_REQUIRED')
      const peerId = await api.getOrCreateConversation(currentUser.id, friendId)
      const shell = await api.ensureConversation(currentUser.id, peerId)
      setConversations((prev) => {
        if (prev.some((chat) => chat.id === shell.id)) {
          return prev.map((chat) => (chat.id === shell.id ? shell : chat))
        }
        return [shell, ...prev]
      })
      setActiveConversationId(peerId)
      return peerId
    },
    [currentUser, requireAuth],
  )

  const sendMessage = useCallback(
    async (peerId: string, text: string) => {
      if (!requireAuth()) return
      if (!currentUser) return
      const clean = sanitizeUserText(text, 2000)
      if (!clean) return
      const t = getTranslations(language)
      if (!tryAction(`dm:${currentUser.id}:${peerId}`)) {
        toast.info(t.auth.slowDown)
        return
      }

      try {
        const message = await api.sendMessage(peerId, currentUser.id, clean)

        setConversations((prev) => {
          const exists = prev.some((chat) => chat.id === peerId)
          if (!exists) {
            void refreshChats({ silent: true })
            return prev
          }
          return prev
            .map((chat) => {
              if (chat.id !== peerId) return chat
              if (chat.messages.some((item) => item.id === message.id)) {
                return {
                  ...chat,
                  lastMessage: message.text,
                  updatedAt: message.createdAt,
                }
              }
              return {
                ...chat,
                messages: [...chat.messages, message],
                lastMessage: message.text,
                updatedAt: message.createdAt,
              }
            })
            .sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            )
        })
      } catch (error) {
        toast.error(toUserFacingError(error, t.auth.authFailed))
      }
    },
    [currentUser, refreshChats, requireAuth, language],
  )

  const openNotifications = useCallback(() => {
    if (!requireAuth()) return
    setNotificationsOpen(true)
  }, [requireAuth])
  const closeNotifications = useCallback(() => setNotificationsOpen(false), [])
  const openGame = useCallback(() => {
    if (!requireAuth()) return
    setGameOpen(true)
  }, [requireAuth])
  const closeGame = useCallback(() => setGameOpen(false), [])

  const submitGameScore = useCallback(
    async (score: number) => {
      if (!currentUser) return { isNewHigh: false }
      const { profile, isNewHigh } = await api.updateGameHighScore(
        currentUser.id,
        score,
      )
      setCurrentUser(profile)
      return { isNewHigh }
    },
    [currentUser],
  )

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  )

  const value = useMemo<AppContextValue>(
    () => ({
      isConfigured: isSupabaseConfigured,
      authReady,
      language,
      setLanguage,
      isAuthenticated: Boolean(currentUser),
      currentUser,
      authModalOpen,
      openAuthModal,
      closeAuthModal,
      requireAuth,
      signUp,
      signIn,
      requestPasswordReset,
      updatePassword,
      logout,
      updateProfile,
      posts,
      stories,
      feedLoading,
      feedError,
      refreshFeed,
      createPost,
      createStory,
      markStoriesAsViewed,
      toggleLike,
      addComment,
      followingIds,
      toggleFollow,
      startChatWith,
      conversations,
      activeConversationId,
      setActiveConversationId,
      sendMessage,
      chatsLoading,
      refreshChats,
      notifications,
      unreadNotificationCount,
      refreshNotifications,
      markNotificationsAsRead,
      notificationsOpen,
      openNotifications,
      closeNotifications,
      gameOpen,
      openGame,
      closeGame,
      submitGameScore,
    }),
    [
      authReady,
      language,
      setLanguage,
      currentUser,
      authModalOpen,
      openAuthModal,
      closeAuthModal,
      requireAuth,
      signUp,
      signIn,
      requestPasswordReset,
      updatePassword,
      logout,
      updateProfile,
      posts,
      stories,
      feedLoading,
      feedError,
      refreshFeed,
      createPost,
      createStory,
      markStoriesAsViewed,
      toggleLike,
      addComment,
      followingIds,
      toggleFollow,
      startChatWith,
      conversations,
      activeConversationId,
      sendMessage,
      chatsLoading,
      refreshChats,
      notifications,
      unreadNotificationCount,
      refreshNotifications,
      markNotificationsAsRead,
      notificationsOpen,
      openNotifications,
      closeNotifications,
      gameOpen,
      openGame,
      closeGame,
      submitGameScore,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
