import { requireSupabase } from '@/lib/supabase'

function extensionFromFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && fromName.length <= 5) return fromName
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  return 'jpg'
}

export async function uploadImage(
  bucket: 'avatars' | 'posts',
  userId: string,
  file: File,
): Promise<string> {
  const supabase = requireSupabase()
  const ext = extensionFromFile(file)
  const path = `${userId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })

  if (error) {
    throw new Error(error.message)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  return uploadImage('avatars', userId, file)
}

export async function uploadPostImage(userId: string, file: File): Promise<string> {
  return uploadImage('posts', userId, file)
}
