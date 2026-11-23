import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.png',
        'apple-touch-icon.png',
        'app-icon-192.png',
        'app-icon-512.png',
        'og-aroha.jpg',
        'robots.txt',
        'notifications-sw.js',
      ],
      manifest: {
        id: '/',
        name: 'AROHA — Personal Evolution System',
        short_name: 'AROHA',
        description: 'Schedule, habits, focus and AI coaching in one tactical dashboard.',
        start_url: '/home',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0D14',
        theme_color: '#0B0D14',
        categories: ['productivity', 'lifestyle', 'health'],
        icons: [
          {
            src: '/app-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/app-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/app-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Command Center',
            short_name: 'Home',
            url: '/home',
            icons: [{ src: '/app-icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Daily Schedule',
            short_name: 'Schedule',
            url: '/schedule',
            icons: [{ src: '/app-icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Deep Focus Timer',
            short_name: 'Focus',
            url: '/focus',
            icons: [{ src: '/app-icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'AROHA AI Coach',
            short_name: 'Coach',
            url: '/coach',
            icons: [{ src: '/app-icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff,woff2}'],
        navigateFallbackDenylist: [/^\/api\//, /^\/sitemap\.xml$/, /^\/robots\.txt$/],
        importScripts: ['/notifications-sw.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: false,
  },
});
