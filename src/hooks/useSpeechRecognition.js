import { useState, useRef, useCallback } from 'react'

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null

export function useSpeechRecognition({ onResult } = {}) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef(null)

  const isSupported = !!SpeechRecognition

  const start = useCallback(() => {
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1]
      const text = result[0].transcript
      setTranscript(text)
      if (result.isFinal && onResult) {
        onResult(text)
      }
    }

    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
    setTranscript('')
  }, [onResult])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }, [])

  return { isListening, isSupported, transcript, start, stop }
}
