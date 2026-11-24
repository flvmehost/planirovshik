import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Относительные пути работают и на Vercel, и на GitHub Pages.
  base: './',
})
