import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/caveat/latin-600.css'
import '../index.css'
import PostitApp from './PostitApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PostitApp />
  </StrictMode>,
)
