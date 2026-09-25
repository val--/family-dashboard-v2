import { NOTE_COLORS, shortAgo } from './theme'
import { Sticker } from './stickers'
import { photoUrl } from './photos'

// A small deterministic tilt so a wall of notes feels hand-placed (static: no animation on the Pi)
export function tilt(id) {
  return ((id * 37) % 5) - 2
}

const SIZES = {
  sm: { box: 'px-3 py-2', text: () => 'text-xl line-clamp-2', sticker: 'w-6 h-6', sign: 'text-base' },
  md: {
    box: 'p-3',
    text: (len) => (len <= 50 ? 'text-2xl line-clamp-4' : len <= 110 ? 'text-xl line-clamp-4' : 'text-lg line-clamp-5'),
    sticker: 'w-8 h-8',
    sign: 'text-base',
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

// `showDate` adds the age of the note to the signature (wall and screensaver).
// `photoSrc` overrides the note's own photo (the phone previews a photo before it is uploaded).
// `onPhotoClick` makes the photo tappable in the large version (full screen viewer).
export default function PostitNote({ note, size = 'md', rotate = 0, className = '', onClick, photoSrc, onPhotoClick, showDate = false }) {
  const s = SIZES[size]
  const color = NOTE_COLORS[note.color] || NOTE_COLORS.yellow
  const photo = photoSrc || (note.photo ? photoUrl(note.photo) : null)
  const style = rotate ? { transform: `rotate(${rotate}deg)` } : undefined
  const base = `relative overflow-hidden rounded-md text-stone-800 ${color} ${onClick ? 'cursor-pointer' : ''} ${className}`

  // Large with a photo: photo on top (a polaroid in the note's color), caption below
  if (photo && size === 'lg') {
    return (
      <div onClick={onClick} style={style} className={`${base} flex flex-col gap-2 p-4`}>
        <img
          src={photo}
          alt=""
          onClick={onPhotoClick}
          className={`min-h-0 w-full flex-1 rounded-sm object-cover ${onPhotoClick ? 'cursor-zoom-in' : ''}`}
        />
        <div className="flex items-start gap-2">
          <div className={`${TEXT} flex-1 line-clamp-3 ${note.text.length <= 60 ? 'text-2xl' : 'text-xl'}`}>{note.text}</div>
          {note.sticker && <Sticker id={note.sticker} className="w-10 h-10 shrink-0" />}
        </div>
        <Signature note={note} showDate={showDate} className="text-xl" />
      </div>
    )
  }

  // Wall tile with a photo: a small thumbnail beside the text (the sticker sits on its corner), and the
  // signature on its own full-width line underneath, so "author · age" fits on one line. The full
  // picture is one tap away.
  if (photo && size === 'md') {
    return (
      <div onClick={onClick} style={style} className={`${base} flex flex-col justify-between gap-1 p-2`}>
        <div className="flex min-h-0 gap-2">
          <div className="relative h-20 w-20 shrink-0">
            <img src={photo} alt="" loading="lazy" decoding="async" className="h-full w-full rounded-sm object-cover" />
            {note.sticker && (
              <span className="absolute -bottom-1 -right-1 rounded-full bg-white/85 p-0.5">
                <Sticker id={note.sticker} className="h-6 w-6" />
              </span>
            )}
          </div>
          <div className="font-hand font-semibold whitespace-pre-line break-words min-w-0 flex-1 text-lg leading-[1.1] line-clamp-4">
            {note.text}
          </div>
        </div>
        <Signature note={note} showDate={showDate} className="text-base" />
      </div>
    )
  }

  return (
    <div onClick={onClick} style={style} className={`${base} flex flex-col justify-between ${s.box}`}>
      <div className="flex items-start gap-2">
        {photo && <img src={photo} alt="" loading="lazy" decoding="async" className="h-10 w-10 shrink-0 rounded-sm object-cover" />}
        <div className={`${TEXT} flex-1 ${s.text(note.text.length)}`}>{note.text}</div>
        {note.sticker && <Sticker id={note.sticker} className={`${s.sticker} shrink-0`} />}
      </div>
      <Signature note={note} showDate={showDate} className={`mt-1 ${s.sign}`} />
    </div>
  )
}
