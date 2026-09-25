import { NOTE_COLORS } from './theme'
import { Sticker } from './stickers'

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
    sign: 'text-lg',
  },
  lg: { box: 'p-5', text: (len) => (len <= 80 ? 'text-4xl' : len <= 140 ? 'text-3xl' : 'text-2xl'), sticker: 'w-12 h-12', sign: 'text-2xl' },
}

export default function PostitNote({ note, size = 'md', rotate = 0, className = '', onClick }) {
  const s = SIZES[size]
  const color = NOTE_COLORS[note.color] || NOTE_COLORS.yellow

  return (
    <div
      onClick={onClick}
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
      className={`relative flex flex-col justify-between overflow-hidden rounded-md text-stone-800 ${color} ${s.box} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className="flex items-start gap-2">
        <div className={`font-hand font-semibold leading-tight whitespace-pre-line break-words flex-1 min-w-0 ${s.text(note.text.length)}`}>
          {note.text}
        </div>
        {note.sticker && <Sticker id={note.sticker} className={`${s.sticker} shrink-0`} />}
      </div>
      <div className={`mt-1 self-end font-hand font-semibold text-stone-600 ${s.sign}`}>— {note.author}</div>
    </div>
  )
}
