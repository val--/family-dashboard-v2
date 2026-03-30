import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useMovieSearch } from '../hooks/useMovieSearch'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'

function StreamingProviders({ tmdbId }) {
  const [providers, setProviders] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/api/tmdb/streaming/${tmdbId}`)
      .then((r) => r.json())
      .then((json) => setProviders(json.providers || []))
      .catch(() => setProviders([]))
      .finally(() => setLoading(false))
  }, [tmdbId])

  if (loading) return <div className="text-sm text-white/30">Recherche des plateformes...</div>

  if (providers.length === 0) {
    return <div className="text-sm text-white/40">Non disponible en streaming</div>
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm text-white/40">Disponible en streaming :</div>
      <div className="flex gap-3 flex-wrap">
        {providers.map((p) => (
          <div key={p.name} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
            {p.logo && <img src={p.logo} alt="" className="w-6 h-6 rounded" />}
            <span className="text-sm text-white/70">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ========================
//  Step 1: Search
// ========================

function SearchStep({ onSelect }) {
  const [query, setQuery] = useState('')
  const { results, hasSearched, loading, error, search } = useMovieSearch()

  const handleSearch = useCallback(() => {
    if (query.trim()) search(query)
  }, [query, search])

  const { isSupported, isListening, start, stop } = useSpeechRecognition({
    onResult: (text) => {
      setQuery(text)
      search(text)
    },
  })

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex items-center gap-3 bg-white/[0.06] rounded-2xl px-5 py-3 ring-1 ring-white/10 focus-within:ring-white/25">
        <svg className="w-5 h-5 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Quel film cherchez-vous ?"
          autoFocus
          className="flex-1 bg-transparent text-xl text-white placeholder-white/30 outline-none"
        />
        {isSupported && (
          <button
            onClick={isListening ? stop : start}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isListening ? 'bg-red-500' : 'hover:bg-white/10'
            }`}
          >
            {isListening ? (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
              </span>
            ) : (
              <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>
        )}
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-xl text-base font-medium text-white shrink-0"
        >
          {loading ? '...' : 'Chercher'}
        </button>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      <div className="flex-1 overflow-y-auto flex flex-col gap-1">
        {results.map((movie) => (
          <button
            key={movie.tmdbId}
            onClick={() => onSelect(movie)}
            className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 text-left min-h-[72px]"
          >
            {movie.poster ? (
              <img src={movie.poster} alt="" className="w-12 h-18 object-cover rounded shrink-0" />
            ) : (
              <div className="w-12 h-18 bg-white/10 rounded shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-lg text-white truncate">
                {movie.title}
                {movie.year && <span className="text-white/40 ml-2">({movie.year})</span>}
              </div>
              <div className="text-sm text-white/40 line-clamp-1">{movie.overview}</div>
              {movie.inLibrary && (
                <span className="text-xs text-green-400 font-medium">Déjà dans la bibliothèque</span>
              )}
            </div>
          </button>
        ))}
        {!loading && hasSearched && results.length === 0 && (
          <div className="text-white/30 text-center py-8">Aucun résultat</div>
        )}
      </div>
    </div>
  )
}

// ========================
//  Step 2: Details
// ========================

function DetailsStep({ movie, onBack, onAdd }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex gap-6 items-start">
        <div className="h-full max-h-[60vh] aspect-[2/3] shrink-0">
          {movie.poster ? (
            <img src={movie.poster} alt={movie.title} className="h-full w-full object-cover rounded-lg" />
          ) : (
            <div className="h-full w-full bg-white/10 rounded-lg" />
          )}
        </div>
        <div className="flex flex-col gap-3 min-w-0 flex-1">
          <h2 className="text-2xl font-light text-white">{movie.title}</h2>
          <div className="flex items-center gap-3 flex-wrap">
            {movie.year && <span className="text-base text-white/40">{movie.year}</span>}
            {movie.runtime > 0 && <span className="text-base text-white/40">{movie.runtime} min</span>}
          </div>
          {movie.genres?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {movie.genres.map((g) => (
                <span key={g} className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-white/60">{g}</span>
              ))}
            </div>
          )}
          {movie.overview && (
            <p className="text-sm text-white/50 leading-relaxed line-clamp-4">{movie.overview}</p>
          )}

          <StreamingProviders tmdbId={movie.tmdbId} />

          {movie.inLibrary && (
            <div className="px-3 py-2 bg-green-500/20 rounded-lg text-sm text-green-400 font-medium mt-1">
              Ce film est déjà dans votre bibliothèque
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={onBack}
          className="px-5 py-3 rounded-xl text-base text-white/50 hover:text-white"
        >
          Retour
        </button>
        {!movie.inLibrary && (
          <button
            onClick={onAdd}
            className="flex-1 py-4 bg-orange-500 hover:bg-orange-600 rounded-xl text-lg font-medium text-white"
          >
            Télécharger ce film
          </button>
        )}
      </div>
    </div>
  )
}

// ========================
//  Step 3: Confirm
// ========================

function AddStep({ movie, status, onClose }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full">
      {status === 'loading' && (
        <>
          <span className="relative flex h-8 w-8">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-8 w-8 bg-orange-500" />
          </span>
          <div className="text-lg text-white/50">Ajout en cours...</div>
        </>
      )}
      {status === 'success' && (
        <>
          <div className="w-16 h-16 bg-green-500/80 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6l3 3 5-5" />
            </svg>
          </div>
          <div className="text-xl text-white">{movie.title} ajouté</div>
          <div className="text-base text-white/50">Le téléchargement va commencer automatiquement</div>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-base text-white"
          >
            Fermer
          </button>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="text-xl text-red-400">Erreur lors de l'ajout</div>
          <div className="text-sm text-white/40">Le film existe peut-être déjà dans Radarr</div>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-base text-white"
          >
            Fermer
          </button>
        </>
      )}
    </div>
  )
}

// ========================
//  Main Modal
// ========================

const STEPS = { SEARCH: 0, DETAILS: 1, ADD: 2 }

export default function MovieSearch({ onClose }) {
  const [step, setStep] = useState(STEPS.SEARCH)
  const [selected, setSelected] = useState(null)
  const { addMovie, addStatus } = useMovieSearch()

  const stepTitle = ['Rechercher un film', 'Détails du film', 'Ajout en cours'][step]

  function handleAdd() {
    setStep(STEPS.ADD)
    addMovie(selected.tmdbId)
  }

  return createPortal(
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between p-4">
        <div className="text-lg uppercase tracking-wider text-white/40">
          {stepTitle}
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white text-3xl leading-none w-12 h-12 flex items-center justify-center"
        >
          &times;
        </button>
      </div>
      <div className="flex-1 overflow-hidden px-4 pb-4">
        {step === STEPS.SEARCH && (
          <SearchStep
            onSelect={(movie) => {
              setSelected(movie)
              setStep(STEPS.DETAILS)
            }}
          />
        )}
        {step === STEPS.DETAILS && selected && (
          <DetailsStep
            movie={selected}
            onBack={() => setStep(STEPS.SEARCH)}
            onAdd={handleAdd}
          />
        )}
        {step === STEPS.ADD && selected && (
          <AddStep movie={selected} status={addStatus} onClose={onClose} />
        )}
      </div>
    </div>,
    document.body,
  )
}
