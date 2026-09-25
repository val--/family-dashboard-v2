import { useState, useEffect, useRef, useCallback } from 'react'

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'touchstart', 'keydown', 'wheel']

// `idle` becomes true after `timeoutMs` without any user activity.
// While idle, activity is ignored on purpose: only wake() (a tap on the screensaver) ends it,
// so the wake-up tap can never land on a widget underneath.
export function useIdle(timeoutMs) {
  const [idle, setIdle] = useState(false)
  const lastActivity = useRef(Date.now())
  const idleRef = useRef(false)

  useEffect(() => {
    // Listeners only store a timestamp (cheap on a Pi); a slow timer does the comparison
    const onActivity = () => {
      if (!idleRef.current) lastActivity.current = Date.now()
    }
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }))

    const timer = setInterval(() => {
      if (!idleRef.current && Date.now() - lastActivity.current >= timeoutMs) {
        idleRef.current = true
        setIdle(true)
      }
    }, Math.min(5000, timeoutMs / 2))

    return () => {
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity))
      clearInterval(timer)
    }
  }, [timeoutMs])

  const wake = useCallback(() => {
    lastActivity.current = Date.now()
    idleRef.current = false
    setIdle(false)
  }, [])

  // Manual sleep (the moon button): same state as running out of time
  const sleep = useCallback(() => {
    idleRef.current = true
    setIdle(true)
  }, [])

  return { idle, wake, sleep }
}
