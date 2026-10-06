import { useEffect, useRef, useState } from 'react'

export const CLIP_SECONDS = 10
const STRIP_FRAMES = 8

// Duration, shape and a still of the first frame of a picked video. Rejects when this browser can't read it
// (the server may still read it: the phone then just has no preview).
export function readVideo(url) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    const done = (value, failed) => {
      video.removeAttribute('src')
      video.load()
      failed ? reject(value) : resolve(value)
    }
    const timer = setTimeout(() => done(new Error('timeout'), true), 15000)
    video.onerror = () => {
      clearTimeout(timer)
      done(new Error('unreadable'), true)
    }
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.1, video.duration / 2 || 0)
    }
    video.onseeked = () => {
      clearTimeout(timer)
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 800 / Math.max(video.videoWidth, video.videoHeight))
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
      const info = { duration: video.duration, ratio: video.videoWidth / video.videoHeight }
      canvas.toBlob((still) => done({ ...info, still }), 'image/jpeg', 0.8)
    }
    video.src = url
  })
}

function clock(seconds) {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// A few frames along the video, drawn small, to find your way on the timeline. Best effort: none if
// the browser can't seek in this video.
function useFilmstrip(url, duration) {
  const [frames, setFrames] = useState([])
  useEffect(() => {
    if (!url || !duration) return
    let cancelled = false
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = url
    const canvas = document.createElement('canvas')
    const seek = (time) =>
      new Promise((resolve, reject) => {
        video.onseeked = resolve
        video.onerror = reject
        video.currentTime = time
      })
    ;(async () => {
      try {
        await new Promise((resolve, reject) => {
          video.onloadeddata = resolve
          video.onerror = reject
        })
        canvas.height = 64
        canvas.width = Math.round((64 * video.videoWidth) / video.videoHeight) || 64
        const ctx = canvas.getContext('2d')
        const found = []
        for (let i = 0; i < STRIP_FRAMES && !cancelled; i++) {
          await seek(((i + 0.5) * duration) / STRIP_FRAMES)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          found.push(canvas.toDataURL('image/jpeg', 0.6))
          if (!cancelled) setFrames([...found])
        }
      } catch {
        // no filmstrip: the plain track still works
      }
    })()
    return () => {
      cancelled = true
      video.removeAttribute('src')
      video.load()
    }
  }, [url, duration])
  return frames
}

// The video plays the chosen 10 seconds in a loop; below, the whole video as a strip with a 10 s window
// you drag with a finger (or the mouse). A tap elsewhere on the strip brings the window there.
// `onFrame` receives a still of the start of the clip (the post-it preview shows it).
export default function VideoTrimmer({ url, duration, start, onChange, onFrame }) {
  const video = useRef(null)
  const track = useRef(null)
  const drag = useRef(null) // { offset } while dragging: where in the window the finger took it
  const grabbedFor = useRef(null) // the start whose still was last sent (the loop seeks back every 10 s)
  const frames = useFilmstrip(url, duration)
  const windowShare = Math.min(1, CLIP_SECONDS / duration)
  const maxStart = Math.max(0, duration - CLIP_SECONDS)

  // Keeps the preview inside the window
  function loop() {
    const v = video.current
    if (!v || drag.current) return
    if (v.currentTime < start - 0.3 || v.currentTime >= start + CLIP_SECONDS) v.currentTime = start
  }

  useEffect(() => {
    const v = video.current
    if (!v) return
    v.currentTime = start
  }, [start])

  function grabFrame() {
    const v = video.current
    if (!v?.videoWidth || !onFrame || grabbedFor.current === start || Math.abs(v.currentTime - start) > 0.3) return
    grabbedFor.current = start
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 800 / Math.max(v.videoWidth, v.videoHeight))
    canvas.width = Math.round(v.videoWidth * scale)
    canvas.height = Math.round(v.videoHeight * scale)
    canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => blob && onFrame(blob), 'image/jpeg', 0.8)
  }

  function startAt(clientX, offset) {
    const rect = track.current.getBoundingClientRect()
    const share = (clientX - rect.left) / rect.width - offset
    return Math.min(maxStart, Math.max(0, share * duration))
  }

  function onPointerDown(event) {
    const rect = track.current.getBoundingClientRect()
    const at = (event.clientX - rect.left) / rect.width
    const left = start / duration
    // On the window: drag it from where it was taken; elsewhere: center it under the finger
    const offset = at >= left && at <= left + windowShare ? at - left : windowShare / 2
    drag.current = { offset }
    track.current.setPointerCapture(event.pointerId)
    video.current?.pause()
    onChange(startAt(event.clientX, offset))
  }

  function onPointerMove(event) {
    if (!drag.current) return
    onChange(startAt(event.clientX, drag.current.offset))
  }

  function onPointerUp() {
    if (!drag.current) return
    drag.current = null
    const v = video.current
    if (v) {
      v.currentTime = start
      v.play().catch(() => {})
    }
  }

  return (
    <div>
      <video
        ref={video}
        src={url}
        muted
        playsInline
        autoPlay
        onTimeUpdate={loop}
        onSeeked={() => !drag.current && grabFrame()}
        className="max-h-[45vh] w-full rounded-xl bg-black object-contain"
      />
      <div
        ref={track}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative mt-3 h-16 cursor-pointer touch-none select-none overflow-hidden rounded-lg bg-stone-800"
      >
        <div className="absolute inset-0 flex">
          {frames.map((src, i) => (
            <img key={i} src={src} alt="" draggable={false} className="h-full min-w-0 flex-1 object-cover" />
          ))}
        </div>
        {/* outside the window: dimmed */}
        <div className="absolute inset-y-0 left-0 bg-black/60" style={{ width: `${(start / duration) * 100}%` }} />
        <div className="absolute inset-y-0 right-0 bg-black/60" style={{ width: `${(1 - start / duration - windowShare) * 100}%` }} />
        <div
          className="absolute inset-y-0 rounded-lg border-[3px] border-sky-400 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          style={{ left: `${(start / duration) * 100}%`, width: `${windowShare * 100}%` }}
        >
          <div className="absolute inset-y-0 left-0 my-auto h-6 w-1.5 -translate-x-[4.5px] rounded-full bg-sky-400" />
          <div className="absolute inset-y-0 right-0 my-auto h-6 w-1.5 translate-x-[4.5px] rounded-full bg-sky-400" />
        </div>
      </div>
      <div className="mt-2 flex justify-between text-sm text-stone-400">
        <span>
          Gardé : <span className="text-white">{clock(start)} → {clock(Math.min(duration, start + CLIP_SECONDS))}</span>
        </span>
        <span>Vidéo de {clock(duration)}</span>
      </div>
      <p className="mt-1 text-sm text-stone-500">Fais glisser le cadre bleu sur les 10 secondes à garder.</p>
    </div>
  )
}
