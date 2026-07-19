import axios, { type AxiosError } from 'axios'
import type { CatProfile, Conversation, Post, Story } from '@/types'
import {
  mockConversations,
  mockPosts,
  mockProfiles,
  mockStories,
} from '@/services/mockData'

const api = axios.create({
  baseURL: '/api',
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const message =
      (error.response?.data as { message?: string } | undefined)?.message ||
      error.message ||
      'Unexpected network error'
    return Promise.reject(new Error(message))
  },
)

const delay = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms))

/** Simulates network latency against local mock datasets. */
async function mockGet<T>(data: T, shouldFail = false): Promise<T> {
  await delay()
  if (shouldFail) {
    throw new Error('Mock request failed')
  }
  return structuredClone(data)
}

export async function fetchFeed(): Promise<Post[]> {
  try {
    return await mockGet(mockPosts)
  } catch (error) {
    console.error('[api] fetchFeed failed:', error)
    throw error
  }
}

export async function fetchStories(): Promise<Story[]> {
  try {
    return await mockGet(mockStories)
  } catch (error) {
    console.error('[api] fetchStories failed:', error)
    throw error
  }
}

export async function fetchProfile(userId: string): Promise<CatProfile> {
  try {
    const profile = mockProfiles.find((item) => item.id === userId)
    if (!profile) {
      throw new Error('Profile not found')
    }
    return await mockGet(profile)
  } catch (error) {
    console.error('[api] fetchProfile failed:', error)
    throw error
  }
}

export async function fetchSuggestedCats(
  currentUserId: string,
): Promise<CatProfile[]> {
  try {
    const others = mockProfiles.filter((item) => item.id !== currentUserId)
    return await mockGet(others)
  } catch (error) {
    console.error('[api] fetchSuggestedCats failed:', error)
    throw error
  }
}

export async function fetchConversations(): Promise<Conversation[]> {
  try {
    return await mockGet(mockConversations)
  } catch (error) {
    console.error('[api] fetchConversations failed:', error)
    throw error
  }
}

export async function fetchUserPosts(userId: string): Promise<Post[]> {
  try {
    const posts = mockPosts.filter((post) => post.authorId === userId)
    return await mockGet(posts)
  } catch (error) {
    console.error('[api] fetchUserPosts failed:', error)
    throw error
  }
}

export default api
