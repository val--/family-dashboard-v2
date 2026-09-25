import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Two pages: the kiosk dashboard and the light post-it page opened from phones (/postit)
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        postit: resolve(import.meta.dirname, 'postit.html'),
      },
    },
  },
})
