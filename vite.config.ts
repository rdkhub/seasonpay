/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

// Los tests de dominio dependen de la zona horaria local (semanas, medianoche).
// Fijamos una zona de montaña para que den igual en Windows, Mac o CI.
process.env.TZ = 'America/Denver';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png', 'splash/*.png'],
      manifest: {
        id: '/',
        name: 'SeasonPay',
        short_name: 'SeasonPay',
        description: 'Turnos, propinas, overtime, boletas, ahorro y envíos a casa para trabajadores de temporada J-1 y H-2B.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B1220',
        theme_color: '#0B1220',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // Notificaciones (push y clic): public/push-sw.js
        importScripts: ['push-sw.js'],
        // Solo precacheamos la fuente latina; las otras escrituras no se usan.
        globIgnores: ['**/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2', '**/splash/*.png', '**/og-image.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /\.(png|jpg|svg|pdf|json|txt)$/],
        cleanupOutdatedCaches: true,
        // Las versiones nuevas se activan solas (sin quedar "en espera").
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'api/**/*.test.js', 'supabase/**/*.test.ts'],
    env: { TZ: 'America/Denver' },
  },
});
