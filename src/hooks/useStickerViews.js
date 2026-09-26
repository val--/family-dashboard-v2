import { useCallback, useState } from 'react'

const KEY = 'postit-sticker-view'

function load() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'))
  } catch {
    return new Set()
  }
}

// Which notes are shown as their sticker instead of their photo (per screen, survives reloads)
export function useStickerViews() {
  const [ids, setIds] = useState(load)

  const toggle = useCallback((id) => {
    setIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(KEY, JSON.stringify([...next]))
      } catch {
        // private mode: the choice just won't survive a reload
      }
      return next
    })
  }, [])

  return { isSticker: (id) => ids.has(id), toggle }
}
