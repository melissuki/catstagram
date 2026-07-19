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
import {
  fetchConversations,
  fetchFeed,
  fetchStories,
} from '@/services/api'
import { CURRENT_USER_ID, mockProfiles } from '@/services/mockData'
import {
  loadStreakFromStorage,
  markFedToday,
  saveStreakToStorage,
} from '@/utils/streak'

interface AppContextValue {
  language: Language
  setLanguage: (language: Language) => void
  isAuthenticated: boolean
  currentUser: CatProfile | null
  login: (profile: Partial<CatProfile> & Pick<CatProfile, 'name'>) => void
  logout: () => void
  updateProfile: (updates: Partial<CatProfile>) => void
  posts: Post[]
  stories: Story[]
  feedLoading: boolean
  feedError: string | null
  refreshFeed: () => Promise<void>
  toggleLike: (postId: string) => void
  addComment: (postId: string, text: string) => void
  followingIds: string[]
  toggleFollow: (catId: string) => void
  conversations: Conversation[]
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  sendMessage: (conversationId: string, text: string) => void
  chatsLoading: boolean
  streak: MamaStreak
  feedCat: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

const AUTH_STORAGE_KEY = 'catstagram_auth'
const LANGUAGE_STORAGE_KEY = 'catstagram_language'
const FOLLOWING_STORAGE_KEY = 'catstagram_following'

function loadLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return stored === 'tr' ? 'tr' : 'en'
}

function loadAuth(): CatProfile | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as CatProfile
  } catch {
    return null
  }
}

function loadFollowing(): string[] {
  try {
    const stored = localStorage.getItem(FOLLOWING_STORAGE_KEY)
    if (!stored) return ['cat-olive']
    return JSON.parse(stored) as string[]
  } catch {
    return ['cat-olive']
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(loadLanguage)
  const [currentUser, setCurrentUser] = useState<CatProfile | null>(loadAuth)
  const [posts, setPosts] = useState<Post[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [followingIds, setFollowingIds] = useState<string[]>(loadFollowing)
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

  const login = useCallback(
    (profile: Partial<CatProfile> & Pick<CatProfile, 'name'>) => {
      const base = mockProfiles.find((item) => item.id === CURRENT_USER_ID)!
      const nextUser: CatProfile = {
        ...base,
        ...profile,
        id: CURRENT_USER_ID,
        name: profile.name,
      }
      setCurrentUser(nextUser)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser))
    },
    [],
  )

  const logout = useCallback(() => {
    setCurrentUser(null)
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }, [])

  const updateProfile = useCallback((updates: Partial<CatProfile>) => {
    setCurrentUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...updates }
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const refreshFeed = useCallback(async () => {
    setFeedLoading(true)
    setFeedError(null)
    try {
      const [feedData, storyData] = await Promise.all([
        fetchFeed(),
        fetchStories(),
      ])
      setPosts(feedData)
      setStories(storyData)
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Failed to load feed')
    } finally {
      setFeedLoading(false)
    }
  }, [])

  const toggleLike = useCallback((postId: string) => {
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post
        const likedByMe = !post.likedByMe
        return {
          ...post,
          likedByMe,
          likes: likedByMe ? post.likes + 1 : Math.max(0, post.likes - 1),
        }
      }),
    )
  }, [])

  const addComment = useCallback(
    (postId: string, text: string) => {
      if (!currentUser || !text.trim()) return

      const comment = {
        id: `c-${Date.now()}`,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        text: text.trim(),
        createdAt: new Date().toISOString(),
      }

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

  const toggleFollow = useCallback((catId: string) => {
    setFollowingIds((prev) => {
      const next = prev.includes(catId)
        ? prev.filter((id) => id !== catId)
        : [...prev, catId]
      localStorage.setItem(FOLLOWING_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const loadChats = useCallback(async () => {
    setChatsLoading(true)
    try {
      const data = await fetchConversations()
      setConversations(data)
    } catch (error) {
      console.error(error)
    } finally {
      setChatsLoading(false)
    }
  }, [])

  const sendMessage = useCallback(
    (conversationId: string, text: string) => {
      if (!currentUser || !text.trim()) return

      const message: Message = {
        id: `m-${Date.now()}`,
        senderId: currentUser.id,
        text: text.trim(),
        createdAt: new Date().toISOString(),
      }

      setConversations((prev) =>
        prev.map((chat) =>
          chat.id === conversationId
            ? {
                ...chat,
                messages: [...chat.messages, message],
                lastMessage: message.text,
                updatedAt: message.createdAt,
                unread: 0,
              }
            : chat,
        ),
      )
    },
    [currentUser],
  )

  const feedCat = useCallback(() => {
    setStreak((prev) => {
      const next = markFedToday(prev)
      saveStreakToStorage(next)
      return next
    })
  }, [])

  useEffect(() => {
    if (currentUser) {
      void refreshFeed()
      void loadChats()
    }
  }, [currentUser, refreshFeed, loadChats])

  useEffect(() => {
    saveStreakToStorage(streak)
  }, [streak])

  const value = useMemo<AppContextValue>(
    () => ({
      language,
      setLanguage,
      isAuthenticated: Boolean(currentUser),
      currentUser,
      login,
      logout,
      updateProfile,
      posts,
      stories,
      feedLoading,
      feedError,
      refreshFeed,
      toggleLike,
      addComment,
      followingIds,
      toggleFollow,
      conversations,
      activeConversationId,
      setActiveConversationId,
      sendMessage,
      chatsLoading,
      streak,
      feedCat,
    }),
    [
      language,
      setLanguage,
      currentUser,
      login,
      logout,
      updateProfile,
      posts,
      stories,
      feedLoading,
      feedError,
      refreshFeed,
      toggleLike,
      addComment,
      followingIds,
      toggleFollow,
      conversations,
      activeConversationId,
      sendMessage,
      chatsLoading,
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
