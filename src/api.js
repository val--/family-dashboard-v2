// Where the dashboard API lives (set at build time; the phone page uses it too)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'

// Demo build (VITE_DEMO=true): widgets show the mocks instead of calling the API
export const DEMO = import.meta.env.VITE_DEMO === 'true'
