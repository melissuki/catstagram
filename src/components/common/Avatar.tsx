const FALLBACK =
  'https://placehold.co/200x200/ffd6c0/5c5a66?text=Cat'

interface AvatarProps {
  src: string
  alt: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  ring?: boolean
  className?: string
}

const sizeMap = {
  sm: 'h-8 w-8',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
  xl: 'h-24 w-24',
}

export function Avatar({
  src,
  alt,
  size = 'md',
  ring = false,
  className = '',
}: AvatarProps) {
  const image = (
    <img
      src={src || FALLBACK}
      alt={alt}
      className={`${sizeMap[size]} rounded-full object-cover bg-peach-light ${className}`}
    />
  )

  if (!ring) return image

  return (
    <div className="story-ring rounded-full p-[2.5px]">
      <div className="rounded-full bg-cream p-[2px]">{image}</div>
    </div>
  )
}
