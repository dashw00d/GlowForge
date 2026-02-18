import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { browserQueuePlugin } from './src/server/browser-api-plugin.js'
import { scaffoldPlugin } from './src/server/scaffold-plugin.js'
import { buildPlugin } from './src/server/build-plugin.js'
import { schedulesPlugin } from './src/server/schedules-plugin.js'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    browserQueuePlugin(),
    scaffoldPlugin(),
    buildPlugin(),
    schedulesPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5274,
    host: '0.0.0.0',
    allowedHosts: ['.glow'],
    proxy: {
      '/lantern-api': {
        target: 'http://127.0.0.1:4777',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/lantern-api/, ''),
      },
      '/loom-api': {
        target: 'http://127.0.0.1:41002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/loom-api/, ''),
      },
    },
  },
})
