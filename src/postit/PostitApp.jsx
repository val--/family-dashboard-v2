import { useCallback, useEffect, useRef, useState } from 'react'
import PostitNote from '../components/postit/Note'
import { Sticker } from '../components/postit/stickers'
import { NOTE_SWATCHES } from '../components/postit/theme'
import * as api from './postitApi'
import { MAX_UPLOAD_BYTES, shrinkImage } from './image'

const AUTHOR_KEY = 'postit-author'
const CODE_KEY = 'postit-code'

function load(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function save(key, value) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // private mode: the phone just asks again next time
  }
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <div className="mx-auto max-w-md px-4 pb-12 pt-6">{children}</div>
    </div>
  )
}

function Title({ children, sub }) {
  return (
    <header className="mb-5">
      <h1 className="font-hand text-5xl font-semibold leading-none">{children}</h1>
      {sub && <p className="mt-1 text-stone-400">{sub}</p>}
    </header>
  )
}

function ErrorLine({ children }) {
  return children ? <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{children}</p> : null
}

function CodeScreen({ onValid }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.verifyCode(code)
      onValid(code)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <Title sub="Entre le code de la famille (une seule fois sur ce téléphone).">Post-it</Title>
      <form onSubmit={submit}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="••••"
          className="w-full rounded-xl bg-stone-800 py-4 text-center text-3xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-sky-400"
        />
        <ErrorLine>{error}</ErrorLine>
        <button
          disabled={code.length < 4 || busy}
          className="mt-4 w-full rounded-xl bg-sky-400 py-4 text-lg font-semibold text-black disabled:opacity-40"
        >
          Entrer
        </button>
      </form>
    </Shell>
  )
}

function WhoScreen({ members, onPick }) {
  return (
    <Shell>
      <Title sub="Choisis ton prénom, on s'en souviendra.">Qui es-tu ?</Title>
      <div className="grid grid-cols-2 gap-3">
        {members.map((name) => (
          <button
            key={name}
            onClick={() => onPick(name)}
            className="rounded-2xl bg-stone-800 px-4 py-6 font-hand text-3xl font-semibold active:bg-stone-700"
          >
            {name}
          </button>
        ))}
      </div>
    </Shell>
  )
}

function Composer({ author, config, code, onPosted, onAuthError }) {
  const [text, setText] = useState('')
  const [color, setColor] = useState(() => config.colors[Math.max(0, config.members.indexOf(author)) % config.colors.length])
  const [sticker, setSticker] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [preparing, setPreparing] = useState(false)
  const fileInput = useRef(null)

  useEffect(() => () => photoPreview && URL.revokeObjectURL(photoPreview), [photoPreview])

  function dropPhoto() {
    setPhoto(null)
    setPhotoPreview(null)
  }

  async function pickPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // lets the same picture be chosen again
    if (!file) return
    setError('')
    setPreparing(true)
    const ready = await shrinkImage(file)
    setPreparing(false)
    if (ready.size > MAX_UPLOAD_BYTES) {
      setError('Cette photo est trop lourde (12 Mo maximum).')
      return
    }
    setPhoto(ready)
    setPhotoPreview(URL.createObjectURL(ready))
  }

  async function send() {
    setSending(true)
    setError('')
    try {
      await api.createNote({ author, text, color, sticker, code }, photo)
      setText('')
      setSticker(null)
      dropPhoto()
      setDone(true)
      setTimeout(() => setDone(false), 3000)
      onPosted()
    } catch (err) {
      if (err.status === 403) onAuthError()
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const preview = { id: 0, author, text: text.trim() || 'Ton message apparaîtra ici…', color, sticker }

  return (
    <section>
      <PostitNote note={preview} size="lg" rotate={-1} photoSrc={photoPreview} className={`mx-auto aspect-square w-full max-w-xs ${text.trim() ? '' : 'opacity-60'}`} />

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={config.maxChars}
        rows={3}
        placeholder="Écris ton mot pour la famille…"
        className="mt-5 w-full resize-none rounded-xl bg-stone-800 p-3 text-base outline-none focus:ring-2 focus:ring-sky-400"
      />
      <div className="mt-1 text-right text-sm text-stone-400">
        {text.length} / {config.maxChars}
      </div>

      <h2 className="mb-2 mt-4 text-sm uppercase tracking-wide text-stone-400">Photo</h2>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} className="hidden" />
      <div className="flex gap-3">
        <button
          onClick={() => fileInput.current?.click()}
          disabled={preparing}
          className="flex-1 rounded-xl bg-stone-800 py-3 text-base active:bg-stone-700 disabled:opacity-50"
        >
          {preparing ? 'Préparation…' : photo ? 'Changer la photo' : 'Ajouter une photo'}
        </button>
        {photo && (
          <button onClick={dropPhoto} className="rounded-xl bg-stone-800 px-4 py-3 text-red-300 active:bg-stone-700">
            Retirer
          </button>
        )}
      </div>

      <h2 className="mb-2 mt-5 text-sm uppercase tracking-wide text-stone-400">Couleur</h2>
      <div className="flex gap-3">
        {config.colors.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={c}
            aria-pressed={color === c}
            className={`h-10 w-10 rounded-full ${NOTE_SWATCHES[c]} ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-stone-950' : ''}`}
          />
        ))}
      </div>

      <h2 className="mb-2 mt-5 text-sm uppercase tracking-wide text-stone-400">Sticker</h2>
      <div className="grid grid-cols-6 gap-2">
        <button
          onClick={() => setSticker(null)}
          aria-pressed={sticker === null}
          className={`flex aspect-square items-center justify-center rounded-xl bg-stone-800 text-stone-400 ${sticker === null ? 'ring-2 ring-white' : ''}`}
        >
          aucun
        </button>
        {config.stickers.map((id) => (
          <button
            key={id}
            onClick={() => setSticker(id)}
            aria-label={id}
            aria-pressed={sticker === id}
            className={`flex aspect-square items-center justify-center rounded-xl bg-stone-800 ${sticker === id ? 'ring-2 ring-white' : ''}`}
          >
            <Sticker id={id} className="h-8 w-8" />
          </button>
        ))}
      </div>

      <ErrorLine>{error}</ErrorLine>
      <button
        onClick={send}
        disabled={!text.trim() || sending}
        className="mt-6 w-full rounded-xl bg-sky-400 py-4 text-lg font-semibold text-black disabled:opacity-40"
      >
        {sending ? 'Envoi…' : 'Coller sur le mur'}
      </button>
      {done && <p className="mt-3 text-center text-green-400">✓ Post-it collé sur le mur !</p>}
    </section>
  )
}

function MyNotes({ notes, auth, onChanged, onAuthError }) {
  const [error, setError] = useState('')

  async function run(action) {
    setError('')
    try {
      await action()
      onChanged()
    } catch (err) {
      if (err.status === 403) onAuthError()
      setError(err.message)
    }
  }

  if (notes.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm uppercase tracking-wide text-stone-400">Mes post-it sur le mur</h2>
      <div className="space-y-4">
        {notes.map((note) => (
          <div key={note.id}>
            <PostitNote note={note} size="sm" />
            <div className="mt-1 flex gap-4 text-sm">
              <button onClick={() => run(() => api.pinNote(note.id, auth, !note.pinned))} className="text-sky-300">
                {note.pinned ? 'Désépingler' : 'Épingler (ne disparaît pas)'}
              </button>
              <button
                onClick={() => window.confirm('Supprimer ce post-it ?') && run(() => api.deleteNote(note.id, auth))}
                className="text-red-300"
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
      <ErrorLine>{error}</ErrorLine>
    </section>
  )
}

export default function PostitApp() {
  const [info, setInfo] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [author, setAuthor] = useState(() => load(AUTHOR_KEY))
  const [code, setCode] = useState(() => load(CODE_KEY))

  const refresh = useCallback(async () => {
    try {
      setInfo(await api.getNotes())
      setLoadError('')
    } catch (err) {
      setLoadError(err.message)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (!info) {
    return (
      <Shell>
        <Title>Post-it</Title>
        <p className="text-stone-400">{loadError || 'Chargement…'}</p>
        {loadError && (
          <button onClick={refresh} className="mt-4 rounded-xl bg-stone-800 px-4 py-3">
            Réessayer
          </button>
        )}
      </Shell>
    )
  }

  const { config, notes } = info
  const forgetCode = () => {
    save(CODE_KEY, null)
    setCode(null)
  }

  if (config.codeRequired && !code) {
    return (
      <CodeScreen
        onValid={(value) => {
          save(CODE_KEY, value)
          setCode(value)
        }}
      />
    )
  }

  if (!author || !config.members.includes(author)) {
    return (
      <WhoScreen
        members={config.members}
        onPick={(name) => {
          save(AUTHOR_KEY, name)
          setAuthor(name)
        }}
      />
    )
  }

  const auth = { author, code: code || '' }

  return (
    <Shell>
      <Title sub="Écris un mot, il apparaîtra sur l'écran de la maison.">Salut {author} !</Title>
      <Composer author={author} config={config} code={code || ''} onPosted={refresh} onAuthError={forgetCode} />
      <MyNotes notes={notes.filter((n) => n.author === author)} auth={auth} onChanged={refresh} onAuthError={forgetCode} />
      <button
        onClick={() => {
          save(AUTHOR_KEY, null)
          setAuthor(null)
        }}
        className="mt-10 text-sm text-stone-500 underline"
      >
        Ce n'est pas {author} ? Changer
      </button>
    </Shell>
  )
}
