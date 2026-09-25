import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import PostitNote, { tilt } from './postit/Note'
import { timeAgo } from './postit/theme'
import { photoUrl } from './postit/photos'
import QrCode from './QrCode'
import ArrowButton from './ArrowButton'

const CELLS_PER_PAGE = 6 // 3 columns x 2 rows, the QR tile takes the first cell of the first page

// Where the phones go. Defaults to this very site, so it works from whatever address the kiosk uses.
const POSTIT_URL = import.meta.env.VITE_POSTIT_URL || `${window.location.origin}/postit`

function Modal({ onClose, children }) {
  return createPortal(
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-end pr-2 pt-2">
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="text-white/70 hover:text-white text-3xl leading-none w-12 h-12 flex items-center justify-center"
        >
          &times;
        </button>
      </div>
      {children}
    </div>,
    document.body,
  )
}

function QrCell({ onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-3 min-h-0 rounded-md bg-white/10 p-3 text-left"
    >
      <QrCode value={POSTIT_URL} className="w-24 h-24 shrink-0 rounded" />
      <div className="min-w-0">
        <div className="font-hand text-2xl font-semibold leading-tight text-white">Écris un post-it !</div>
        <div className="mt-1 text-sm text-white/60">Touche pour agrandir le QR code</div>
      </div>
    </button>
  )
}

export default function PostIts({ postits, openRequest }) {
  const { notes, config, loading, error } = postits
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(null)
  const [showQr, setShowQr] = useState(false)
  const [viewing, setViewing] = useState(null)

  // Asked to show a note (tapped on the screensaver): its detail opens over the wall, and closing
  // it leaves you on the wall
  useEffect(() => {
    if (openRequest?.note) setSelected(openRequest.note)
  }, [openRequest])

  const cells = [{ type: 'qr' }, ...notes.map((note) => ({ type: 'note', note }))]
  const pages = Math.ceil(cells.length / CELLS_PER_PAGE)
  const current = Math.min(page, pages - 1)
  const visible = cells.slice(current * CELLS_PER_PAGE, (current + 1) * CELLS_PER_PAGE)
  const empty = !loading && !error && notes.length === 0

  return (
    <>
      <div className="h-full flex items-center gap-1">
        {pages > 1 && (
          <ArrowButton direction="prev" label="Page précédente" enabled={current > 0} onClick={() => setPage(current - 1)} />
        )}
        <div className="h-full min-w-0 flex-1 grid grid-cols-3 grid-rows-2 gap-4">
          {visible.map((cell) =>
            cell.type === 'qr' ? (
              <QrCell key="qr" onOpen={() => setShowQr(true)} />
            ) : (
              <PostitNote
                key={cell.note.id}
                note={cell.note}
                rotate={tilt(cell.note.id)}
                showDate
                className="min-h-0"
                onClick={() => setSelected(cell.note)}
              />
            ),
          )}
          {empty && current === 0 && (
            <div className="col-span-2 flex items-center justify-center px-4 text-center font-hand text-2xl text-white/70">
              Pas encore de post-it. Scanne le QR code pour écrire le premier !
            </div>
          )}
          {error && notes.length === 0 && (
            <div className="col-span-2 flex items-center justify-center px-4 text-center text-white/60">
              Les post-it sont indisponibles pour le moment.
            </div>
          )}
        </div>
        {pages > 1 && (
          <ArrowButton direction="next" label="Page suivante" enabled={current < pages - 1} onClick={() => setPage(current + 1)} />
        )}
      </div>

      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <div className="flex-1 flex flex-col items-center justify-center gap-4 overflow-y-auto px-8 pb-8">
            <PostitNote
              note={selected}
              size="lg"
              rotate={-1}
              onPhotoClick={() => setViewing(selected.photo)}
              className="h-[min(70vh,20rem)] aspect-square shrink-0"
            />
            <div className="text-sm text-white/60">
              {timeAgo(selected.createdAt)}
              {selected.pinned && ' · épinglé'}
              {selected.photo && ' · touche la photo pour l’agrandir'}
            </div>
          </div>
        </Modal>
      )}

      {viewing && (
        <Modal onClose={() => setViewing(null)}>
          <div className="flex-1 min-h-0 flex items-center justify-center px-2 pb-3" onClick={() => setViewing(null)}>
            <img src={photoUrl(viewing, true)} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        </Modal>
      )}

      {showQr && (
        <Modal onClose={() => setShowQr(false)}>
          <div className="flex-1 flex items-center justify-center gap-8 px-8 pb-8">
            <QrCode value={POSTIT_URL} className="h-[min(70vh,20rem)] aspect-square shrink-0 rounded-lg" />
            <div className="max-w-xs">
              <h2 className="font-hand text-4xl font-semibold text-white">Écris un post-it</h2>
              <ol className="mt-3 list-decimal pl-5 text-lg text-white/80 space-y-1">
                <li>Scanne ce code avec ton téléphone, connecté au Wi‑Fi de la maison</li>
                <li>Choisis ton prénom{config?.codeRequired && ' et entre le code famille'}</li>
                <li>Écris, choisis une couleur et colle-le !</li>
              </ol>
              <p className="mt-4 text-sm text-white/50 break-all">{POSTIT_URL}</p>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
