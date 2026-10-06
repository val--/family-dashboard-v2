import { createPortal } from 'react-dom'

// The full-screen panel behind every detail view, list and settings screen: black, an optional title on
// the left, and a big × on the right (a 48 px target: easy to hit on the touchscreen).
// `heading` makes the title a big page title (Paramètres) instead of a small label (Agenda…).
export default function FullScreen({ title, heading = false, onClose, children }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className={`flex items-center ${title ? 'justify-between' : 'justify-end'} pl-6 pr-2 pt-2`}>
        {title &&
          (heading ? (
            <h1 className="text-2xl font-light text-white">{title}</h1>
          ) : (
            <div className="text-sm uppercase tracking-wider text-white/60">{title}</div>
          ))}
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="flex h-12 w-12 items-center justify-center text-3xl leading-none text-white/70 hover:text-white"
        >
          &times;
        </button>
      </div>
      {children}
    </div>,
    document.body,
  )
}
