import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/glpi': {
        target: 'http://127.0.0.1:80',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/glpi/, '/apirest.php')
      }
    }
  }
})