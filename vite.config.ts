import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { browserQueuePlugin } from './src/server/browser-api-plugin.js'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    browserQueuePlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5274,
    host: '0.0.0.0',
  },
})
