import { requireSupabase } from '@/services/supabaseClient'

/** Single public bucket created in the Supabase dashboard. */
export const STORAGE_BUCKET = 'cat-photos' as const

function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'image.jpg'
  const cleaned = base
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/^\-+|\-+$/g, '')

  return cleaned.slice(0, 80) || 'image.jpg'
}

function buildObjectPath(folder: 'profiles' | 'posts', file: File): string {
  const safeName = sanitizeFileName(file.name)
  // Clean single-segment folders — no leading/trailing or double slashes
  return `${folder}/${Date.now()}-${safeName}`
}

async function uploadToCatPhotos(
  folder: 'profiles' | 'posts',
  file: File,
): Promise<string> {
  const supabase = requireSupabase()
  const path = buildObjectPath(folder, file)

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })

  if (error) {
    throw new Error(error.message)
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadAvatar(_userId: string, file: File): Promise<string> {
  return uploadToCatPhotos('profiles', file)
}

export async function uploadPostImage(_userId: string, file: File): Promise<string> {
  return uploadToCatPhotos('posts', file)
}
