import { NOTE_COLORS, shortAgo } from './theme'
import { Sticker } from './stickers'
import { photoUrl, stickerUrl } from './photos'

// A small deterministic tilt so a wall of notes feels hand-placed (static: no animation on the Pi)
export function tilt(id) {
  return ((id * 37) % 5) - 2
}

const SIZES = {
  sm: { box: 'px-3 py-2', text: () => 'text-xl line-clamp-2', sticker: 'w-6 h-6', sign: 'text-base' },
  md: {
    box: 'p-3',
    text: (len) => (len <= 50 ? 'text-xl line-clamp-4' : len <= 110 ? 'text-lg line-clamp-4' : 'text-base line-clamp-5'),
    sticker: 'w-7 h-7',
    sign: 'text-sm',
  },
  lg: { box: 'p-5', text: (len) => (len <= 80 ? 'text-4xl' : len <= 140 ? 'text-3xl' : 'text-2xl'), sticker: 'w-12 h-12', sign: 'text-2xl' },
}

const SIGNATURE = 'font-hand font-semibold text-stone-600'
const TEXT = 'font-hand font-semibold leading-tight whitespace-pre-line break-words min-w-0'

// "— Papa" or "— Papa · il y a 2 h": always one line, right-aligned
function Signature({ note, showDate, className = '' }) {
  return (
    <div className={`self-end text-right ${SIGNATURE} ${className}`}>
      — {note.author}
      {showDate && ` · ${shortAgo(note.createdAt)}`}
    </div>
  )
}

// Dog-ear on notes that have a sticker version: tap it to swap photo <-> sticker. It sits top-LEFT: on a
// note with a photo that corner always holds the photo (left in portrait, on top in landscape), never text.
// The note's corner is really cut away (see cornerClip); this flap is the folded paper, in the note's own
// color made lighter (its back), with a small shadow on the note. The icon says what a tap will show.
const FOLD = { md: 30, lg: 42 }

function cornerClip(px) {
  return `polygon(${px}px 0, 100% 0, 100% 100%, 0 100%, 0 ${px}px)`
}

function StickerFold({ showingSticker, onToggle, px, color }) {
  const icon = px > 34 ? 16 : 12
  return (
    <button
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      aria-label={showingSticker ? 'Voir la photo' : 'Voir le sticker'}
      className="absolute left-0 top-0 z-10"
      style={{ width: px + 20, height: px + 20 }} // bigger than the flap: easy to hit with a finger
    >
      <span className="absolute left-0 top-0 block" style={{ width: px, height: px, filter: 'drop-shadow(1px 2px 1.5px rgba(0,0,0,0.35))' }}>
        <span
          className={`absolute inset-0 block ${color}`}
          style={{
            clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
            backgroundImage: 'linear-gradient(315deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.45) 32%, rgba(0,0,0,0.07) 50%)',
          }}
        />
        <svg
          className="absolute text-stone-600"
          style={{ right: 2, bottom: 2, width: icon, height: icon }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {showingSticker ? (
            <>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="10" r="1.6" />
              <path d="M21 16l-5-5-8 8" />
            </>
          ) : (
            <>
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M8.1 8.1 20 20M8.1 15.9 20 4" />
            </>
          )}
        </svg>
      </span>
    </button>
  )
}

// `showDate` adds the age of the note to the signature (wall and screensaver).
// `photoSrc` overrides the note's own photo (the phone previews a photo before it is uploaded).
// `onPhotoClick` makes the photo tappable in the large version (full screen viewer).
export default function PostitNote({
  note, size = 'md', rotate = 0, className = '', onClick, photoSrc, onPhotoClick, showDate = false,
  showSticker = false, onToggleSticker,
}) {
  const s = SIZES[size]
  const color = NOTE_COLORS[note.color] || NOTE_COLORS.yellow
  // The sticker version exists once ComfyUI has made it (never for the phone's local preview)
  const hasSticker = !photoSrc && Boolean(note.photo) && note.stickerStatus === 'done'
  const stickerOn = hasSticker && showSticker
  const photo = photoSrc || (note.photo ? (stickerOn ? stickerUrl(note.photo) : photoUrl(note.photo)) : null)
  // A sticker must never be cropped: it sits whole on the note's color
  const fit = stickerOn ? 'object-contain' : 'object-cover'
  const foldPx = hasSticker && onToggleSticker && size !== 'sm' ? FOLD[size] : 0
  const fold = foldPx > 0 && <StickerFold showingSticker={stickerOn} onToggle={onToggleSticker} px={foldPx} color={color} />
  const style = {
    ...(rotate ? { transform: `rotate(${rotate}deg)` } : {}),
    ...(foldPx ? { clipPath: cornerClip(foldPx) } : {}), // the folded corner is cut out of the note
  }
  const base = `relative overflow-hidden rounded-md text-stone-800 ${color} ${onClick ? 'cursor-pointer' : ''} ${className}`

  // Portrait photo (a phone held upright, 3:4 to 9:20): the photo stands at full height on the left and
  // the caption runs beside it, instead of a thin cropped band. Extremely tall ones are trimmed to 1:2.
  const portrait = photo && (size === 'lg' || size === 'md') && note.photoRatio != null && note.photoRatio < 0.9
  if (portrait) {
    const lg = size === 'lg'
    return (
      <div onClick={onClick} style={style} className={`${base} flex flex-col ${lg ? 'gap-2 p-4' : 'gap-1 p-2'}`}>
        {fold}
        <div className={`flex min-h-0 flex-1 ${lg ? 'gap-3' : 'gap-2'}`}>
          <img
            src={photo}
            alt=""
            loading={lg ? undefined : 'lazy'}
            decoding="async"
            onClick={onPhotoClick}
            style={{ aspectRatio: Math.max(note.photoRatio, 0.5) }}
            className={`h-full shrink-0 rounded-sm ${fit} ${lg ? 'max-w-[55%]' : 'max-w-[45%]'} ${onPhotoClick ? 'cursor-zoom-in' : ''}`}
          />
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
            <div className={`${TEXT} ${lg ? (note.text.length <= 60 ? 'text-2xl line-clamp-6' : 'text-xl line-clamp-7') : 'text-base leading-tight line-clamp-5'}`}>
              {note.text}
            </div>
            {note.sticker && <Sticker id={note.sticker} className={`${lg ? 'w-10 h-10' : 'w-6 h-6'} shrink-0 self-end`} />}
          </div>
        </div>
        <Signature note={note} showDate={showDate} className={lg ? 'text-xl' : 'text-sm leading-tight'} />
      </div>
    )
  }

  // Large with a photo: photo on top (a polaroid in the note's color), caption below
  if (photo && size === 'lg') {
    return (
      <div onClick={onClick} style={style} className={`${base} flex flex-col gap-2 p-4`}>
        {fold}
        <img
          src={photo}
          alt=""
          onClick={onPhotoClick}
          className={`min-h-0 w-full flex-1 rounded-sm ${fit} ${onPhotoClick ? 'cursor-zoom-in' : ''}`}
        />
        <div className="flex items-start gap-2">
          <div className={`${TEXT} flex-1 line-clamp-3 ${note.text.length <= 60 ? 'text-2xl' : 'text-xl'}`}>{note.text}</div>
          {note.sticker && <Sticker id={note.sticker} className="w-10 h-10 shrink-0" />}
        </div>
        <Signature note={note} showDate={showDate} className="text-xl" />
      </div>
    )
  }

  // Wall tile with a photo: the same polaroid as the screensaver's big card, scaled down (photo on top,
  // caption and sticker below, then the signature). The full picture is one tap away.
  if (photo && size === 'md') {
    return (
      <div onClick={onClick} style={style} className={`${base} flex flex-col gap-1 p-2`}>
        {fold}
        <img src={photo} alt="" loading="lazy" decoding="async" className={`min-h-0 w-full flex-1 rounded-sm ${fit}`} />
        <div className="flex items-start gap-1">
          <div className={`${TEXT} flex-1 text-base leading-tight line-clamp-2`}>{note.text}</div>
          {note.sticker && <Sticker id={note.sticker} className="w-6 h-6 shrink-0" />}
        </div>
        <Signature note={note} showDate={showDate} className="text-sm leading-tight" />
      </div>
    )
  }

  return (
    <div onClick={onClick} style={style} className={`${base} flex flex-col justify-between ${s.box}`}>
      <div className="flex items-start gap-2">
        {photo && <img src={photo} alt="" loading="lazy" decoding="async" className={`h-10 w-10 shrink-0 rounded-sm ${fit}`} />}
        <div className={`${TEXT} flex-1 ${s.text(note.text.length)}`}>{note.text}</div>
        {note.sticker && <Sticker id={note.sticker} className={`${s.sticker} shrink-0`} />}
      </div>
      <Signature note={note} showDate={showDate} className={`mt-1 ${s.sign}`} />
    </div>
  )
}
