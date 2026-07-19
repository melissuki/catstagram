import { requireSupabase } from '@/services/supabaseClient'

/** Must match the public bucket name in the Supabase Storage dashboard. */
export const STORAGE_BUCKET = 'cat-photos' as const

function buildFilePath(file: File): string {
  const cleanExtension = (file.name.split('.').pop() || 'jpg')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${cleanExtension || 'jpg'}`

  // Explicitly starts with a valid text folder — NO leading slash '/'
  const filePath = `public/${uniqueFileName}`

  return filePath
}

async function uploadToCatPhotos(file: File): Promise<string> {
  const supabase = requireSupabase()
  const filePath = buildFilePath(file)

  console.log('CRITICAL UPLOAD PATH:', filePath)

  const { data, error } = await supabase.storage
    .from('cat-photos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('CRITICAL UPLOAD ERROR:', error, { filePath, data })
    throw new Error(error.message)
  }

  const { data: publicData } = supabase.storage
    .from('cat-photos')
    .getPublicUrl(filePath)

  return publicData.publicUrl
}

export async function uploadAvatar(_userId: string, file: File): Promise<string> {
  return uploadToCatPhotos(file)
}

export async function uploadPostImage(_userId: string, file: File): Promise<string> {
  return uploadToCatPhotos(file)
}
