import { useEffect, useId, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'

interface ImageUploadProps {
  label: string
  value: File | null
  onChange: (file: File | null) => void
  previewUrl?: string | null
  helperText?: string
  compact?: boolean
}

export function ImageUpload({
  label,
  value,
  onChange,
  previewUrl = null,
  helperText,
  compact = false,
}: ImageUploadProps) {
  const inputId = useId()
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!value) {
      setObjectUrl(null)
      return
    }

    const nextUrl = URL.createObjectURL(value)
    setObjectUrl(nextUrl)

    return () => {
      URL.revokeObjectURL(nextUrl)
    }
  }, [value])

  const displayUrl = objectUrl ?? previewUrl

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          {label}
        </label>
        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-rose-400"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        ) : null}
      </div>

      <label
        htmlFor={inputId}
        className={`group flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-teal-200/80 bg-gradient-to-br from-white/80 via-teal-50/30 to-emerald-50/20 transition hover:border-teal-300 hover:from-teal-50/40 ${
          compact ? 'min-h-36' : 'min-h-48'
        }`}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Selected preview"
            className="h-full max-h-72 w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-100 to-emerald-100 text-teal-600 shadow-sm transition group-hover:scale-105">
              <ImagePlus className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Choose a photo</p>
            {helperText ? (
              <p className="text-xs text-slate-500">{helperText}</p>
            ) : null}
          </div>
        )}
      </label>

      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          onChange(file)
          event.target.value = ''
        }}
      />
    </div>
  )
}
