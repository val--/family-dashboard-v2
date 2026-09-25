// Same look as the paging arrows of the Films tab: a light chevron in a 32 px round touch target,
// invisible (but still taking its space) when it has nothing to do.
export default function ArrowButton({ direction, onClick, label, enabled = true }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`text-3xl shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${
        enabled ? 'text-white/60 hover:text-white hover:bg-white/10 active:bg-white/10' : 'invisible'
      }`}
    >
      {direction === 'prev' ? '‹' : '›'}
    </button>
  )
}
