/**
 * Strip HTML/script payloads from user-generated text before Supabase writes.
 * Plain-text only — no markup survives to storage or XSS reflection.
 */
export function sanitizeUserText(input: string, maxLength = 2000): string {
  if (!input) return ''

  let text = String(input)
  text = text.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, '')
  text = text.replace(/javascript\s*:/gi, '')
  text = text.replace(/vbscript\s*:/gi, '')
  text = text.replace(/data\s*:\s*text\/html/gi, '')
  text = text.replace(/\bon\w+\s*=/gi, '')
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  text = text.replace(/\s+/g, ' ').trim()
  return text.slice(0, maxLength)
}
