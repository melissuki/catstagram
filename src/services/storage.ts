import { requireSupabase } from '@/services/supabaseClient'

/** Must match the public bucket name in the Supabase Storage dashboard. */
export const STORAGE_BUCKET = 'cat-photos' as const

/**
 * Strip folder separators and non-ASCII / special characters so the object
 * key never breaks Supabase Storage URL parsing (Turkish chars, spaces, etc.).
 */
function cleanFileName(originalName: string): string {
  const baseName = originalName.split(/[/\\]/).pop() || 'image.jpg'

  // Normalize Turkish / accented letters to ASCII-ish forms where possible
  const ascii = baseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')

  const cleaned = ascii
    .trim()
    .replace(/\s+/g, '_') // spaces → underscore (Supabase-safe)
    .replace(/[^a-zA-Z0-9._-]/g, '_') // drop anything else
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .replace(/^_+|_+$/g, '')

  if (!cleaned) return 'image.jpg'

  // Ensure there is a simple extension
  if (!/\.[a-zA-Z0-9]{2,5}$/.test(cleaned)) {
    return `${cleaned}.jpg`
  }

  return cleaned.slice(0, 80)
}

/**
 * Build a Storage object key that NEVER starts with `/` and never contains
 * empty segments or double slashes.
 *
 * Examples:
 *   posts/1710000000000-my_cat.jpg
 *   profiles/1710000000000-avatar.png
 */
function buildFilePath(folder: 'posts' | 'profiles', file: File): string {
  const safeName = cleanFileName(file.name)
  const filePath = `${folder}/${Date.now()}-${safeName}`

  // Hard guardrails against invalid Supabase object keys
  return filePath
    .replace(/^\/+/, '') // no leading slash
    .replace(/\/{2,}/g, '/') // no double slashes
    .replace(/\/+$/, '') // no trailing slash
}

async function uploadToCatPhotos(
  folder: 'posts' | 'profiles',
  file: File,
): Promise<string> {
  const supabase = requireSupabase()
  const filePath = buildFilePath(folder, file)

  if (!filePath || filePath.startsWith('/') || filePath.includes('//')) {
    throw new Error(`Invalid storage path: ${filePath}`)
  }

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg',
    })

  if (error) {
    throw new Error(error.message)
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}

export async function uploadAvatar(_userId: string, file: File): Promise<string> {
  return uploadToCatPhotos('profiles', file)
}

export async function uploadPostImage(_userId: string, file: File): Promise<string> {
  return uploadToCatPhotos('posts', file)
}
