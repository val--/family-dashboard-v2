import { useState, memo } from 'react'

function isCached(src) {
  if (!src) return false
  const img = new Image()
  img.src = src
  return img.complete
}

function Poster({ src, alt, className = '', grayscale = false }) {
  const [loaded, setLoaded] = useState(() => isCached(src))

  return (
    <div className={`relative w-full aspect-[2/3] bg-white/5 rounded overflow-hidden ${className}`}>
      {src && (
        <img
          src={src}
          alt={alt || ''}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
        />
      )}
      {/* Dimmed look via a plain overlay: a CSS filter on an image is much costlier on a Pi GPU */}
      {grayscale && <div className="absolute inset-0 bg-black/60" />}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-5 h-5 text-white/15 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.3" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  )
}

export default memo(Poster)
