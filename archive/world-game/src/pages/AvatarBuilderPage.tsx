import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Check } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationTree } from '@/i18n/translations'
import { PET_LIST, petPreviewPath, type PetKey } from '@/game/petCatalog'
import { TINT_LIST } from '@/game/petTints'
import { EXPR_NAMES } from '@/game/characterCatalog'
import type { PetTint } from '@/types/avatar'

const FACE_PREVIEW = '/game/characters/expressions/faces.png'
const CHAR_PREVIEW = '/game/characters/eris/idle.png'

function tintLabel(t: TranslationTree, tint: PetTint): string {
  switch (tint) {
    case 'sandy':
      return t.avatarBuilder.tint_sandy
    case 'silver':
      return t.avatarBuilder.tint_silver
    case 'blush':
      return t.avatarBuilder.tint_blush
    case 'mint':
      return t.avatarBuilder.tint_mint
    case 'lavender':
      return t.avatarBuilder.tint_lavender
    default:
      return t.avatarBuilder.tint_none
  }
}

/** Approximate CSS filter for Eris white body tints (preview only). */
function tintFilter(tint: PetTint): string {
  switch (tint) {
    case 'sandy':
      return 'sepia(0.45) saturate(1.2) hue-rotate(-10deg)'
    case 'silver':
      return 'grayscale(0.55) brightness(1.05)'
    case 'blush':
      return 'sepia(0.25) hue-rotate(-35deg) saturate(1.4)'
    case 'mint':
      return 'sepia(0.2) hue-rotate(70deg) saturate(1.3)'
    case 'lavender':
      return 'sepia(0.2) hue-rotate(220deg) saturate(1.2)'
    default:
      return 'none'
  }
}

export function AvatarBuilderPage() {
  const { currentUser, updateAvatarConfig } = useApp()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tint, setTint] = useState<PetTint>(currentUser?.avatarConfig.tint ?? 'none')
  const [faceStyle, setFaceStyle] = useState(currentUser?.avatarConfig.faceStyle ?? 4)
  const [saving, setSaving] = useState<PetKey | null>(null)

  if (!currentUser) return null

  const petLabel = (pet: PetKey) =>
    pet === 'mochi' ? t.avatarBuilder.mochiName : t.avatarBuilder.pochiName
  const petBlurb = (pet: PetKey) =>
    pet === 'mochi' ? t.avatarBuilder.mochiBlurb : t.avatarBuilder.pochiBlurb

  const choosePet = async (pet: PetKey) => {
    setSaving(pet)
    try {
      await updateAvatarConfig({ pet, tint, faceStyle })
      toast.success(t.avatarBuilder.saved)
      navigate('/room')
    } catch (error) {
      console.error('[avatar]', error)
      toast.error(t.auth.authFailed)
    } finally {
      setSaving(null)
    }
  }

  const saveLook = async () => {
    if (!currentUser.avatarConfig.pet) return
    setSaving(currentUser.avatarConfig.pet)
    try {
      await updateAvatarConfig({
        pet: currentUser.avatarConfig.pet,
        tint,
        faceStyle,
      })
      toast.success(t.avatarBuilder.saved)
    } catch (error) {
      console.error('[avatar]', error)
      toast.error(t.auth.authFailed)
    } finally {
      setSaving(null)
    }
  }

  const faceCol = faceStyle % 3
  const faceRow = Math.floor(faceStyle / 3)

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="card-panel animate-fade-up p-5 sm:p-6">
        <h2 className="font-brand text-2xl font-bold text-slate-700 dark:text-slate-100">
          {t.avatarBuilder.title}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t.avatarBuilder.subtitle}
        </p>

        <div className="mt-5 rounded-2xl border border-purple-100/50 bg-gradient-to-br from-sky-50 to-green-50 p-4 dark:border-purple-500/20 dark:from-slate-900 dark:to-slate-800">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t.avatarBuilder.charPreview}
          </p>
          <div className="flex items-end gap-4">
            <div
              className="relative h-24 w-24 overflow-hidden rounded-xl bg-sky-100/80 dark:bg-slate-800"
              style={{ imageRendering: 'pixelated' }}
            >
              <img
                src={CHAR_PREVIEW}
                alt=""
                className="h-full w-[400%] max-w-none object-cover object-left-top"
                style={{
                  imageRendering: 'pixelated',
                  filter: tintFilter(tint),
                  width: '400%',
                  height: '500%',
                  maxWidth: 'none',
                  transform: 'scale(1)',
                }}
              />
            </div>
            <div
              className="h-14 w-14 overflow-hidden rounded-lg border border-white/60 bg-black"
              style={{ imageRendering: 'pixelated' }}
            >
              <div
                style={{
                  width: 48,
                  height: 96,
                  backgroundImage: `url(${FACE_PREVIEW})`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: `-${faceCol * 16}px -${faceRow * 16}px`,
                  imageRendering: 'pixelated',
                  transform: 'scale(3.5)',
                  transformOrigin: 'top left',
                }}
              />
            </div>
            <p className="flex-1 text-xs text-slate-500 dark:text-slate-400">
              {t.avatarBuilder.faceHint}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t.avatarBuilder.colorTitle}
          </p>
          <div className="flex flex-wrap gap-2">
            {TINT_LIST.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTint(option)}
                className={tint === option ? 'btn-primary-sm' : 'btn-soft'}
              >
                {tintLabel(t, option)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t.avatarBuilder.faceTitle}
          </p>
          <div className="flex flex-wrap gap-2">
            {EXPR_NAMES.map((name, index) => (
              <button
                key={name}
                type="button"
                onClick={() => setFaceStyle(index)}
                className={faceStyle === index ? 'btn-primary-sm' : 'btn-soft'}
                title={name}
              >
                {name}
              </button>
            ))}
          </div>
          {currentUser.avatarConfig.pet ? (
            <button
              type="button"
              onClick={() => void saveLook()}
              disabled={saving !== null}
              className="btn-soft mt-3"
            >
              {saving ? t.common.loading : 'OK'}
            </button>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {PET_LIST.map((pet) => {
            const isChosen =
              currentUser.avatarConfig.pet === pet &&
              currentUser.avatarConfig.tint === tint &&
              currentUser.avatarConfig.faceStyle === faceStyle
            return (
              <div
                key={pet}
                className={`flex flex-col items-center gap-3 rounded-3xl border-2 p-5 transition ${
                  isChosen
                    ? 'border-pink-400 bg-pink-50/60 dark:bg-pink-950/20'
                    : 'border-purple-100/50 dark:border-purple-500/20'
                }`}
              >
                <div className="h-28 w-28 rounded-2xl bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 p-3 dark:from-purple-950/40 dark:via-pink-950/30 dark:to-orange-950/20">
                  <img
                    src={petPreviewPath(pet, tint)}
                    alt={petLabel(pet)}
                    className="h-full w-full object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
                <p className="font-brand text-lg font-bold text-slate-700 dark:text-slate-100">
                  {petLabel(pet)}
                </p>
                <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                  {petBlurb(pet)}
                </p>
                <button
                  type="button"
                  onClick={() => void choosePet(pet)}
                  disabled={saving !== null}
                  className={isChosen ? 'btn-soft' : 'btn-primary-sm'}
                >
                  {isChosen ? (
                    <>
                      <Check className="h-4 w-4" />
                      {t.avatarBuilder.chosen}
                    </>
                  ) : saving === pet ? (
                    t.common.loading
                  ) : (
                    t.avatarBuilder.choose
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {currentUser.avatarConfig.pet ? (
          <button
            type="button"
            onClick={() => navigate('/room')}
            className="btn-primary mt-6 w-full"
          >
            {t.avatarBuilder.goToRoom}
          </button>
        ) : null}
      </section>
    </div>
  )
}
