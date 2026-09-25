// A rubber-stamp mark ("DERNIER POSTÉ !") laid over a note's corner. It lands with a small thump
// (see .animate-stamp in index.css); remount it (key) to replay. It has its own light backing so it
// reads on any note color, on a photo, or where it sticks out onto the black screen.
export default function Stamp({ big = false }) {
  return (
    <div
      style={{ '--stamp-rotate': big ? '-12deg' : '-7deg' }}
      className={`pointer-events-none absolute animate-stamp rounded-md bg-white/75 text-center font-sans font-black uppercase leading-none tracking-widest text-red-700 ${
        big ? '-left-4 -top-3 border-4 border-double border-red-700 px-3 py-1.5 text-lg' : '-left-3 -top-3 border-2 border-red-700 px-2 py-1 text-xs'
      }`}
    >
      {big ? (
        <>
          Dernier
          <br />
          posté !
        </>
      ) : (
        'Dernier posté !'
      )}
    </div>
  )
}
