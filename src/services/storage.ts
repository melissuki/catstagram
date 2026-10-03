import { requireSupabase } from '@/services/supabaseClient'

/** Must match the public bucket name in the Supabase Storage dashboard. */
export const STORAGE_BUCKET = 'cat-photos' as const

type UploadFolder = 'public' | 'stories'

/** Mirrors the bucket's file_size_limit in security_hardening_v2.sql. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/** Raster images only (no SVG, which can carry scripts). Mirrors the bucket. */
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
])

function buildFilePath(file: File, folder: UploadFolder, userId: string): string {
  const cleanExtension = (file.name.split('.').pop() || 'jpg')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  const uniqueFileName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${cleanExtension || 'jpg'}`

  // <folder>/<user id>/<file>: storage policies only let the owner of the
  // user-id folder delete files in it. No leading slash.
  return `${folder}/${userId}/${uniqueFileName}`
}

async function uploadToCatPhotos(
  file: File,
  folder: UploadFolder = 'public',
): Promise<string> {
  const supabase = requireSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('Only JPEG, PNG, WebP, GIF or HEIC photos can be uploaded')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Image is too large (max 10 MB)')

  const filePath = buildFilePath(file, folder, user.id)

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('[storage] upload failed', error)
    throw new Error(error.message)
  }

  const { data: publicData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath)

  return publicData.publicUrl
}

export async function uploadAvatar(_userId: string, file: File): Promise<string> {
  return uploadToCatPhotos(file, 'public')
}

export async function uploadPostImage(_userId: string, file: File): Promise<string> {
  return uploadToCatPhotos(file, 'public')
}

export async function uploadStoryImage(file: File): Promise<string> {
  return uploadToCatPhotos(file, 'stories')
}
