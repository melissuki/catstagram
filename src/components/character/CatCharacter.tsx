import { useId } from 'react'
import {
  BACKGROUND_STYLES,
  DEFAULT_CHARACTER,
  FUR_STYLES,
  type CharacterConfig,
} from '@/character/catalog'

interface CatCharacterProps {
  config: CharacterConfig
  className?: string
  title?: string
  /** Hide the background (e.g. when previewing on top of another surface). */
  transparent?: boolean
}

const EYE_L = 78
const EYE_R = 122
const EYE_Y = 100

function heartPath(cx: number, cy: number, s = 1): string {
  return `M${cx} ${cy + 8 * s} C${cx - 12 * s} ${cy - 1 * s}, ${cx - 7 * s} ${cy - 11 * s}, ${cx} ${cy - 4 * s} C${cx + 7 * s} ${cy - 11 * s}, ${cx + 12 * s} ${cy - 1 * s}, ${cx} ${cy + 8 * s} Z`
}

function Eyes({ kind, color }: { kind: string; color: string }) {
  switch (kind) {
    case 'eyes_happy':
      return (
        <g fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round">
          <path d={`M${EYE_L - 8} 103 Q${EYE_L} 93 ${EYE_L + 8} 103`} />
          <path d={`M${EYE_R - 8} 103 Q${EYE_R} 93 ${EYE_R + 8} 103`} />
        </g>
      )
    case 'eyes_sleepy':
      return (
        <g fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round">
          <path d={`M${EYE_L - 8} 99 Q${EYE_L} 106 ${EYE_L + 8} 99`} />
          <path d={`M${EYE_R - 8} 99 Q${EYE_R} 106 ${EYE_R + 8} 99`} />
        </g>
      )
    case 'eyes_sparkle':
      return (
        <g>
          {[EYE_L, EYE_R].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy={EYE_Y} r={11} fill={color} />
              <circle cx={cx} cy={EYE_Y + 3} r={6} fill="#8b7bf0" opacity={0.45} />
              <circle cx={cx - 3.5} cy={EYE_Y - 4} r={4} fill="#fff" />
              <circle cx={cx + 4} cy={EYE_Y + 4} r={1.8} fill="#fff" />
            </g>
          ))}
        </g>
      )
    case 'eyes_heart':
      return (
        <g fill="#ff5d8f">
          <path d={heartPath(EYE_L, EYE_Y)} />
          <path d={heartPath(EYE_R, EYE_Y)} />
        </g>
      )
    default:
      return (
        <g>
          {[EYE_L, EYE_R].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy={EYE_Y} r={8.5} fill={color} />
              <circle cx={cx + 3} cy={EYE_Y - 3} r={2.8} fill="#fff" />
            </g>
          ))}
        </g>
      )
  }
}

function Glasses({ kind }: { kind: string }) {
  const frame = '#3b3346'
  const bridge = (
    <path d="M93 98 Q100 93 107 98" fill="none" stroke={frame} strokeWidth={3} strokeLinecap="round" />
  )
  const arms = (
    <g stroke={frame} strokeWidth={3} strokeLinecap="round">
      <path d="M63 97 L45 92" />
      <path d="M137 97 L155 92" />
    </g>
  )
  switch (kind) {
    case 'glasses_sun':
      return (
        <g>
          {arms}
          {bridge}
          <rect x={61} y={90} width={33} height={20} rx={8} fill="#2b2433" />
          <rect x={106} y={90} width={33} height={20} rx={8} fill="#2b2433" />
          <path d="M66 95 L74 95 M111 95 L119 95" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" opacity={0.55} />
        </g>
      )
    case 'glasses_heart':
      return (
        <g>
          {arms}
          {bridge}
          <g fill="#ff6fa0" fillOpacity={0.8} stroke="#d94677" strokeWidth={2} strokeLinejoin="round">
            <path d={heartPath(EYE_L, EYE_Y - 1, 1.55)} />
            <path d={heartPath(EYE_R, EYE_Y - 1, 1.55)} />
          </g>
        </g>
      )
    default:
      return (
        <g>
          {arms}
          {bridge}
          <g fill="#fff" fillOpacity={0.18} stroke={frame} strokeWidth={3}>
            <circle cx={EYE_L} cy={EYE_Y} r={15} />
            <circle cx={EYE_R} cy={EYE_Y} r={15} />
          </g>
        </g>
      )
  }
}

function Hat({ kind }: { kind: string }) {
  switch (kind) {
    case 'hat_bow':
      return (
        <g stroke="#d94677" strokeWidth={2.5} strokeLinejoin="round">
          <path d="M70 50 L50 37 L52 63 Z" fill="#ff7fab" />
          <path d="M70 50 L90 37 L88 63 Z" fill="#ff7fab" />
          <circle cx={70} cy={50} r={6} fill="#ff5d8f" />
        </g>
      )
    case 'hat_flower': {
      const cx = 132
      const cy = 50
      return (
        <g>
          {[0, 72, 144, 216, 288].map((deg) => {
            const rad = (deg * Math.PI) / 180
            return (
              <circle
                key={deg}
                cx={cx + Math.cos(rad) * 8}
                cy={cy + Math.sin(rad) * 8}
                r={7}
                fill="#ffb3cf"
                stroke="#e57fa3"
                strokeWidth={1.5}
              />
            )
          })}
          <circle cx={cx} cy={cy} r={5.5} fill="#ffd34d" stroke="#d9a521" strokeWidth={1.5} />
        </g>
      )
    }
    case 'hat_beanie':
      return (
        <g strokeLinejoin="round">
          <path d="M44 80 Q46 30 100 28 Q154 30 156 80 Z" fill="#7cc4f0" stroke="#4f93bf" strokeWidth={3} />
          <rect x={42} y={68} width={116} height={17} rx={8.5} fill="#5aa9dc" stroke="#4f93bf" strokeWidth={3} />
          <circle cx={100} cy={24} r={10} fill="#fff" stroke="#c9d6e0" strokeWidth={2.5} />
        </g>
      )
    case 'hat_party':
      return (
        <g strokeLinejoin="round">
          <path d="M78 54 L100 6 L122 54 Z" fill="#b18cff" stroke="#7f5fd1" strokeWidth={3} />
          <circle cx={93} cy={40} r={3} fill="#ffd34d" />
          <circle cx={106} cy={30} r={3} fill="#7cf0c4" />
          <circle cx={109} cy={46} r={3} fill="#ff7fab" />
          <circle cx={100} cy={6} r={6} fill="#ffd34d" stroke="#d9a521" strokeWidth={2} />
        </g>
      )
    case 'hat_wizard':
      return (
        <g strokeLinejoin="round">
          <path d="M70 54 Q92 28 104 2 Q110 30 130 54 Z" fill="#5b4bb7" stroke="#3c2f86" strokeWidth={3} />
          <ellipse cx={100} cy={54} rx={50} ry={9} fill="#6a59cc" stroke="#3c2f86" strokeWidth={3} />
          <path
            d="M100 26 L103 33 L110 33 L104.5 37.5 L106.5 44.5 L100 40 L93.5 44.5 L95.5 37.5 L90 33 L97 33 Z"
            fill="#ffd34d"
          />
        </g>
      )
    case 'hat_crown':
      return (
        <g strokeLinejoin="round">
          <path
            d="M66 56 L66 30 L81 43 L100 22 L119 43 L134 30 L134 56 Z"
            fill="#ffd34d"
            stroke="#d9a521"
            strokeWidth={3}
          />
          <circle cx={100} cy={45} r={4.5} fill="#ff6f9f" />
          <circle cx={80} cy={50} r={3} fill="#7cc4f0" />
          <circle cx={120} cy={50} r={3} fill="#7cc4f0" />
        </g>
      )
    default:
      return null
  }
}

function Neck({ kind }: { kind: string }) {
  switch (kind) {
    case 'neck_bowtie':
      return (
        <g stroke="#5b3fa8" strokeWidth={2.5} strokeLinejoin="round" fill="#8f6ff0">
          <path d="M100 152 L80 141 L80 163 Z" />
          <path d="M100 152 L120 141 L120 163 Z" />
          <circle cx={100} cy={152} r={5} fill="#7f5fd1" />
        </g>
      )
    case 'neck_scarf':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M60 140 Q100 164 140 140" fill="none" stroke="#d9663a" strokeWidth={16} />
          <path d="M60 140 Q100 164 140 140" fill="none" stroke="#ff8a5c" strokeWidth={11} />
          <path d="M118 150 L128 180 L112 178 Z" fill="#ff8a5c" stroke="#d9663a" strokeWidth={2.5} />
        </g>
      )
    default:
      return (
        <g>
          <path d="M64 142 Q100 162 136 142" fill="none" stroke="#ff5d73" strokeWidth={8} strokeLinecap="round" />
          <circle cx={100} cy={159} r={7} fill="#ffd34d" stroke="#d9a521" strokeWidth={2} />
          <path d="M96 161 L104 161" stroke="#d9a521" strokeWidth={1.5} strokeLinecap="round" />
        </g>
      )
  }
}

/** The user's customizable cat, drawn as SVG so every item scales cleanly. */
export function CatCharacter({ config, className, title, transparent }: CatCharacterProps) {
  const gradientId = `cat-bg-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const fur = FUR_STYLES[config.fur ?? ''] ?? FUR_STYLES[DEFAULT_CHARACTER.fur as string]
  const bg =
    BACKGROUND_STYLES[config.background ?? ''] ??
    BACKGROUND_STYLES[DEFAULT_CHARACTER.background as string]

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label={title ?? 'Cat character'}
    >
      {title ? <title>{title}</title> : null}
      {!transparent ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={bg.from} />
              <stop offset="100%" stopColor={bg.to} />
            </linearGradient>
          </defs>
          <rect width={200} height={200} fill={`url(#${gradientId})`} />
          {bg.stars ? (
            <g fill="#fff">
              <circle cx={24} cy={30} r={2.2} opacity={0.9} />
              <circle cx={170} cy={40} r={1.8} opacity={0.8} />
              <circle cx={150} cy={16} r={1.4} opacity={0.7} />
              <circle cx={36} cy={150} r={1.6} opacity={0.7} />
              <circle cx={180} cy={122} r={2.2} opacity={0.9} />
              <circle cx={18} cy={92} r={1.3} opacity={0.6} />
            </g>
          ) : null}
        </>
      ) : null}

      <ellipse cx={100} cy={190} rx={52} ry={7} fill="#000" opacity={0.08} />

      {/* Tail */}
      <path d="M136 170 C170 170, 180 140, 164 120" fill="none" stroke={fur.outline} strokeWidth={17} strokeLinecap="round" />
      <path d="M136 170 C170 170, 180 140, 164 120" fill="none" stroke={fur.body} strokeWidth={11} strokeLinecap="round" />

      {/* Body + paws */}
      <ellipse cx={100} cy={160} rx={46} ry={32} fill={fur.body} stroke={fur.outline} strokeWidth={3} />
      <ellipse cx={82} cy={189} rx={12} ry={6.5} fill={fur.body} stroke={fur.outline} strokeWidth={2.5} />
      <ellipse cx={118} cy={189} rx={12} ry={6.5} fill={fur.body} stroke={fur.outline} strokeWidth={2.5} />

      {/* Ears */}
      <g strokeLinejoin="round">
        <path d="M52 80 L58 26 L96 52 Z" fill={fur.body} stroke={fur.outline} strokeWidth={3} />
        <path d="M148 80 L142 26 L104 52 Z" fill={fur.body} stroke={fur.outline} strokeWidth={3} />
        <path d="M61 66 L63 39 L85 54 Z" fill={fur.innerEar} />
        <path d="M139 66 L137 39 L115 54 Z" fill={fur.innerEar} />
      </g>

      {/* Head */}
      <ellipse cx={100} cy={98} rx={58} ry={52} fill={fur.body} stroke={fur.outline} strokeWidth={3} />

      {/* Face */}
      <ellipse cx={64} cy={117} rx={9} ry={5.5} fill="#ff9fb8" opacity={0.5} />
      <ellipse cx={136} cy={117} rx={9} ry={5.5} fill="#ff9fb8" opacity={0.5} />
      <Eyes kind={config.eyes ?? 'eyes_round'} color={fur.eye} />
      <path d="M95 112 L105 112 L100 118 Z" fill="#f28aa5" strokeLinejoin="round" />
      <path
        d="M100 118 Q100 124 94 125 M100 118 Q100 124 106 125"
        fill="none"
        stroke={fur.outline}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <g stroke={fur.outline} strokeWidth={1.8} strokeLinecap="round" opacity={0.6}>
        <path d="M58 112 L36 108" />
        <path d="M58 118 L36 121" />
        <path d="M142 112 L164 108" />
        <path d="M142 118 L164 121" />
      </g>

      {config.neck ? <Neck kind={config.neck} /> : null}
      {config.glasses ? <Glasses kind={config.glasses} /> : null}
      {config.hat ? <Hat kind={config.hat} /> : null}
    </svg>
  )
}
