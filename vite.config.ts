import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icons/icon-192.png", "icons/icon-512.png"],

      // ── Manifest ────────────────────────────────────────────────────────────
      manifest: {
        name: "GigMatcher",
        short_name: "GigMatcher",
        description: "AI-powered gig marketplace for Tier-2/3 India",
        theme_color: "#2563EB",
        background_color: "#F8FAFC",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/?source=pwa",
        scope: "/",
        lang: "en",
        categories: ["productivity", "utilities", "business"],
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Book a Service",
            short_name: "Book",
            description: "Book a service worker instantly",
            url: "/customer/book?source=shortcut",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
          },
          {
            name: "My Bookings",
            short_name: "Bookings",
            description: "View your active bookings",
            url: "/customer/bookings?source=shortcut",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
          },
        ],
      },

      // ── Workbox caching strategies ───────────────────────────────────────────
      workbox: {
        // Precache all built assets
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],

        // Runtime caching rules
        runtimeCaching: [
          // Supabase API — NetworkFirst (always fresh, fallback to cache)
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // FastAPI matching engine — NetworkFirst
          {
            urlPattern: /^https:\/\/gigmatcher-api\.onrender\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "fastapi-cache",
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 2, // 2 minutes
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Images — CacheFirst (stable, long-lived)
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts / CDN assets — CacheFirst
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        // Offline fallback — serve cached index.html for navigation requests
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],

        // Skip waiting so new SW activates immediately on update
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));