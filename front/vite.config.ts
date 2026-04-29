import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    // 開発中は LAN IP / localhost / nginx ホスト名で叩かれる可能性があるため許可。
    allowedHosts: true,
    hmr: {
      // nginx (8443/wss) 経由で HMR WebSocket を張る。
      // nginx 側で /__vite_ws を frontend:3000 へ upgrade する設定と合わせる。
      path: '/__vite_ws',
      clientPort: 8443,
      protocol: 'wss',
    },
    proxy: {
      '/api': {
        target: 'http://backend:3000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpeg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.google\.com\/.*\..*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 48, // 2 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        // dev 環境では SW のキャッシュが旧パスを返して真っ白画面になる事例があるため無効化。
        // 本番ビルド (vite build) では PWA は通常通り有効。
        enabled: false,
        type: 'module',
      },
      manifest: {
        name: '間取り作成ツール',
        short_name: '間取り',
        description: 'スマートフォンカメラで撮影して間取り図を作成するアプリ',
        theme_color: '#1a1a2e',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
