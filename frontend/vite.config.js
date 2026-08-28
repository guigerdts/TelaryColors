import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Dev: forward API calls to the FastAPI backend on :8000.
      // Prod: FastAPI serves frontend/dist (single origin, no CORS).
      '/api': 'http://localhost:8000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true, // lets @testing-library/react register its auto-cleanup
    setupFiles: './src/test-setup.js',
    // Run one test file at a time: several parallel jsdom environments spin
    // up slowly on the aarch64 dev box and time out the forks workers.
    fileParallelism: false,
  },
})