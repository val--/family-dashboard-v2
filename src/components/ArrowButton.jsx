// Paging arrows, the same on every tab and in the detail views: a light chevron in a 32 px round touch
// target, invisible (but still taking its space) when it has nothing to do.
// direction: 'prev' ‹, 'next' ›, or 'first' « (back to the first page).
const SYMBOLS = { prev: '‹', next: '›', first: '«' }

export default function ArrowButton({ direction, onClick, label, enabled = true }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`${direction === 'first' ? 'text-2xl' : 'text-3xl'} shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${
        enabled ? 'text-white/60 hover:text-white hover:bg-white/10 active:bg-white/10' : 'invisible'
      }`}
    >
      {SYMBOLS[direction]}
    </button>
  )
}

// The left side of a pager: the previous page, and under it a quick way back to the first one
export function BackArrows({ page, onPage }) {
  return (
    <div className="flex flex-col items-center gap-3 shrink-0">
      <ArrowButton direction="prev" label="Page précédente" enabled={page > 0} onClick={() => onPage(page - 1)} />
      <ArrowButton direction="first" label="Première page" enabled={page > 0} onClick={() => onPage(0)} />
    </div>
  )
}
