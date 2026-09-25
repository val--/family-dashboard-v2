// Bundled SVG stickers: emoji fonts are not guaranteed on the kiosk, this renders the same everywhere
const DRAWINGS = {
  heart: <path d="M12 21s-7.5-4.6-9.4-9.1C1.3 8.6 3.2 5 6.6 5c2 0 3.6 1.1 5.4 3.2C13.8 6.1 15.4 5 17.4 5c3.4 0 5.3 3.6 4 6.9C19.5 16.4 12 21 12 21z" fill="#ef4444" />,
  star: <polygon points="12,2.5 14.9,8.8 21.7,9.5 16.6,14.1 18.1,20.8 12,17.3 5.9,20.8 7.4,14.1 2.3,9.5 9.1,8.8" fill="#f59e0b" />,
  smile: (
    <>
      <circle cx="12" cy="12" r="10" fill="#fbbf24" />
      <circle cx="9" cy="10" r="1.3" fill="#78350f" />
      <circle cx="15" cy="10" r="1.3" fill="#78350f" />
      <path d="M7.5 14c1 2.5 3 3.5 4.5 3.5s3.5-1 4.5-3.5" stroke="#78350f" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="5" fill="#f59e0b" />
      <g stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line key={deg} x1="12" y1="2" x2="12" y2="4.5" transform={`rotate(${deg} 12 12)`} />
        ))}
      </g>
    </>
  ),
  music: (
    <>
      <path d="M9 18V6l10-2v12" stroke="#4f46e5" strokeWidth="2" fill="none" strokeLinejoin="round" />
      <circle cx="6.5" cy="18" r="2.6" fill="#4f46e5" />
      <circle cx="16.5" cy="16" r="2.6" fill="#4f46e5" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" fill="#a16207" />
      <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" stroke="#a16207" strokeWidth="2" fill="none" />
      <path d="M8 3c-1 1.5 1 2.5 0 4M12 3c-1 1.5 1 2.5 0 4" stroke="#78716c" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </>
  ),
  pizza: (
    <>
      <path d="M12 22L3.5 6.5C8.3 3.5 15.7 3.5 20.5 6.5z" fill="#fbbf24" stroke="#d97706" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M3.5 6.5C8.3 3.5 15.7 3.5 20.5 6.5" stroke="#b45309" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="10" cy="9.8" r="1.5" fill="#dc2626" />
      <circle cx="14.5" cy="11" r="1.5" fill="#dc2626" />
      <circle cx="12" cy="15" r="1.5" fill="#dc2626" />
    </>
  ),
  cat: (
    <>
      <path d="M4 4l4.2 3.3A9 9 0 0 1 15.8 7.3L20 4v9a8 8 0 0 1-16 0z" fill="#fb923c" />
      <circle cx="9" cy="13" r="1.2" fill="#1c1917" />
      <circle cx="15" cy="13" r="1.2" fill="#1c1917" />
      <path d="M11 15.5h2l-1 1.2z" fill="#f43f5e" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="9" width="18" height="12" rx="1.5" fill="#ec4899" />
      <rect x="2" y="6" width="20" height="4" rx="1" fill="#f472b6" />
      <rect x="10.5" y="6" width="3" height="15" fill="#fde047" />
      <path d="M12 6c-3-4-6-3-5-1.2C8 6.5 12 6 12 6zM12 6c3-4 6-3 5-1.2C16 6.5 12 6 12 6z" fill="#fde047" />
    </>
  ),
  party: (
    <>
      <path d="M3 21L8 8l8 8z" fill="#f59e0b" />
      <circle cx="15" cy="5" r="1.3" fill="#ef4444" />
      <circle cx="19.5" cy="9" r="1.3" fill="#3b82f6" />
      <path d="M12 3.5l1 2M20 14.5l-2 .5" stroke="#10b981" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10.5 10.5c3-1 4-3 4-6" stroke="#a855f7" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </>
  ),
  book: (
    <>
      <path d="M4 4h7a3 3 0 0 1 1 .2V20a3 3 0 0 0-1-.2H4z" fill="#3b82f6" />
      <path d="M20 4h-7a3 3 0 0 0-1 .2V20a3 3 0 0 1 1-.2h7z" fill="#60a5fa" />
    </>
  ),
  ball: (
    <>
      <circle cx="12" cy="12" r="9.5" fill="#fff" stroke="#1c1917" strokeWidth="1.4" />
      <path d="M12 7.5l3.4 2.5-1.3 4h-4.2L8.6 10z" fill="#1c1917" />
      <path d="M12 7.5V3M15.4 10l4-1.4M14.1 14l2.4 3.4M9.9 14l-2.4 3.4M8.6 10l-4-1.4" stroke="#1c1917" strokeWidth="1.2" />
    </>
  ),
}

export function Sticker({ id, className = 'w-8 h-8' }) {
  const drawing = DRAWINGS[id]
  if (!drawing) return null
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {drawing}
    </svg>
  )
}
