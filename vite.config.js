import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator'

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    ...(command === 'build' ? [obfuscatorPlugin({
      include: ['src/**/*.js', 'src/**/*.jsx'],
      exclude: [/node_modules/],
      debugger: true,
      options: {
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.5,
        transformObjectKeys: false,
      }
    })] : [])
  ],
  build: {
    sourcemap: false,
  },
  // ── Dev proxy: routes /api/openrouter → openrouter.ai server-side ──
  // Bypasses ad blockers & CORS since the HTTP call is made by Node, not the browser
  server: {
    proxy: {
      '/api/openrouter': {
        target: 'https://openrouter.ai/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openrouter/, ''),
        secure: true,
      }
    }
  }
})

