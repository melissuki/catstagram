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
  CatProfile,
  Conversation,
  Language,
  MamaStreak,
  Message,
  Post,
  Story,
} from '@/types'
import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase'
import * as api from '@/services/api'
import {
  loadStreakFromStorage,
  markFedToday,
  saveStreakToStorage,
} from '@/utils/streak'

interface AppContextValue {
  isConfigured: boolean
  authReady: boolean
  language: Language
  setLanguage: (language: Language) => void
  isAuthenticated: boolean
  currentUser: CatProfile | null
  signUp: (input: api.SignUpInput) => Promise<void>
  signIn: (input: api.SignInInput) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (updates: {
    name: string
    breed: string
    age: number
    bio: string
    avatarFile?: File | null
  }) => Promise<void>
  posts: Post[]
  stories: Story[]
  feedLoading: boolean
  feedError: string | null
  refreshFeed: () => Promise<void>
  createPost: (file: File, caption: string) => Promise<void>
  toggleLike: (postId: string) => Promise<void>
  addComment: (postId: string, text: string) => Promise<void>
  followingIds: string[]
  toggleFollow: (catId: string) => Promise<void>
  startChatWith: (friendId: string) => Promise<string>
  conversations: Conversation[]
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  sendMessage: (conversationId: string, text: string) => Promise<void>
  chatsLoading: boolean
  refreshChats: () => Promise<void>
  streak: MamaStreak
  feedCat: () => void
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
  const [streak, setStreak] = useState<MamaStreak>(loadStreakFromStorage)

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
  }, [])

  const refreshFeed = useCallback(async () => {
    if (!currentUser) return
    setFeedLoading(true)
    setFeedError(null)
    try {
      const [feedData, storyData, following] = await Promise.all([
        api.fetchFeed(currentUser.id),
        api.fetchStories(currentUser.id),
        api.fetchFollowingIds(currentUser.id),
      ])
      setPosts(feedData)
      setStories(storyData)
      setFollowingIds(following)
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Failed to load feed')
    } finally {
      setFeedLoading(false)
    }
  }, [currentUser])

  const refreshChats = useCallback(async () => {
    if (!currentUser) return
    setChatsLoading(true)
    try {
      const data = await api.fetchConversations(currentUser.id)
      setConversations(data)
    } catch (error) {
      console.error(error)
    } finally {
      setChatsLoading(false)
    }
  }, [currentUser])

  const bootstrapSession = useCallback(async (userId: string) => {
    const profile = await api.fetchProfileById(userId)
    setCurrentUser(profile)
  }, [])

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
        setPosts([])
        setStories([])
        setConversations([])
        setFollowingIds([])
        return
      }
      void bootstrapSession(session.user.id)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [bootstrapSession])

  useEffect(() => {
    if (!currentUser) return
    void refreshFeed()
    void refreshChats()
  }, [currentUser, refreshFeed, refreshChats])

  useEffect(() => {
    if (!currentUser || !isSupabaseConfigured) return
    return api.subscribeToFeed(() => {
      void refreshFeed()
    })
  }, [currentUser, refreshFeed])

  useEffect(() => {
    if (!activeConversationId || !isSupabaseConfigured) return

    return api.subscribeToMessages(activeConversationId, (message: Message) => {
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
    })
  }, [activeConversationId])

  useEffect(() => {
    saveStreakToStorage(streak)
  }, [streak])

  const signUp = useCallback(async (input: api.SignUpInput) => {
    const profile = await api.signUp(input)
    setCurrentUser(profile)
  }, [])

  const signIn = useCallback(async (input: api.SignInInput) => {
    const profile = await api.signIn(input)
    setCurrentUser(profile)
  }, [])

  const logout = useCallback(async () => {
    await api.signOut()
    setCurrentUser(null)
  }, [])

  const updateProfile = useCallback(
    async (updates: {
      name: string
      breed: string
      age: number
      bio: string
      avatarFile?: File | null
    }) => {
      if (!currentUser) return
      const next = await api.updateMyProfile(currentUser.id, updates)
      setCurrentUser(next)
    },
    [currentUser],
  )

  const createPost = useCallback(
    async (file: File, caption: string) => {
      if (!currentUser) return
      const post = await api.createPost({
        userId: currentUser.id,
        file,
        caption,
      })
      setPosts((prev) => [post, ...prev])
    },
    [currentUser],
  )

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!currentUser) return
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
        throw error
      }
    },
    [currentUser, posts],
  )

  const addComment = useCallback(
    async (postId: string, text: string) => {
      if (!currentUser || !text.trim()) return
      const comment = await api.addComment(postId, currentUser.id, text)
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, comments: [...post.comments, comment] }
            : post,
        ),
      )
    },
    [currentUser],
  )

  const toggleFollow = useCallback(
    async (catId: string) => {
      if (!currentUser) return
      const isFollowing = await api.toggleFollow(currentUser.id, catId)
      setFollowingIds((prev) =>
        isFollowing
          ? [...prev, catId]
          : prev.filter((id) => id !== catId),
      )
    },
    [currentUser],
  )

  const startChatWith = useCallback(
    async (friendId: string) => {
      if (!currentUser) throw new Error('Not signed in')
      const conversationId = await api.getOrCreateConversation(
        currentUser.id,
        friendId,
      )
      await refreshChats()
      setActiveConversationId(conversationId)
      return conversationId
    },
    [currentUser, refreshChats],
  )

  const sendMessage = useCallback(
    async (conversationId: string, text: string) => {
      if (!currentUser || !text.trim()) return
      const message = await api.sendMessage(conversationId, currentUser.id, text)

      setConversations((prev) =>
        prev.map((chat) => {
          if (chat.id !== conversationId) return chat
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
        }),
      )
    },
    [currentUser],
  )

  const feedCat = useCallback(() => {
    setStreak((prev) => markFedToday(prev))
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      isConfigured: isSupabaseConfigured,
      authReady,
      language,
      setLanguage,
      isAuthenticated: Boolean(currentUser),
      currentUser,
      signUp,
      signIn,
      logout,
      updateProfile,
      posts,
      stories,
      feedLoading,
      feedError,
      refreshFeed,
      createPost,
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
      streak,
      feedCat,
    }),
    [
      authReady,
      language,
      setLanguage,
      currentUser,
      signUp,
      signIn,
      logout,
      updateProfile,
      posts,
      stories,
      feedLoading,
      feedError,
      refreshFeed,
      createPost,
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
      streak,
      feedCat,
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
