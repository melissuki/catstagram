import { requireSupabase } from '@/services/supabaseClient'

/** Must match the public bucket name in the Supabase Storage dashboard. */
export const STORAGE_BUCKET = 'cat-photos' as const

type UploadFolder = 'public' | 'stories'

function buildFilePath(file: File, folder: UploadFolder): string {
  const cleanExtension = (file.name.split('.').pop() || 'jpg')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${cleanExtension || 'jpg'}`

  // Explicit folder prefix — NO leading slash '/'
  return `${folder}/${uniqueFileName}`
}

async function uploadToCatPhotos(
  file: File,
  folder: UploadFolder = 'public',
): Promise<string> {
  const supabase = requireSupabase()
  const filePath = buildFilePath(file, folder)

  console.log('CRITICAL UPLOAD PATH:', filePath)

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('CRITICAL UPLOAD ERROR:', error, { filePath, data })
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
