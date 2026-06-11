import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api.php': {
        target: 'http://localhost',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, req) => {
            console.log('[proxy /api.php] ❌ Erreur:', err.message, '→', req.url)
          })
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('[proxy /api.php] →', req.method, req.url)
          })
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('[proxy /api.php] ←', proxyRes.statusCode, req.url)
          })
        }
      },
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})