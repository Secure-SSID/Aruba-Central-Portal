import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:1344',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'build',
    sourcemap: false,
  },
  optimizeDeps: {
    exclude: ['@imgly/background-removal'], // Exclude from pre-bundling
  },
})
