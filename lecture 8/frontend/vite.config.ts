import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Bind IPv4 explicitly so http://127.0.0.1:5173 (the documented URL) works.
  server: { host: '127.0.0.1' },
})
