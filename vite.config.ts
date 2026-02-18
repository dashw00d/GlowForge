import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { browserQueuePlugin } from './src/server/browser-api-plugin.js'
import { scaffoldPlugin } from './src/server/scaffold-plugin.js'
import { buildPlugin } from './src/server/build-plugin.js'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    browserQueuePlugin(),
    scaffoldPlugin(),
    buildPlugin(),
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
