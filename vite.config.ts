import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
    }),
    viteReact(),
    tailwindcss(),
    tsConfigPaths(),
    nitro({ preset: "vercel" }),
    VitePWA({
      // TanStack Start has no index.html for the plugin to inject into —
      // manifest link + theme-color live in __root.tsx's head(), and the
      // service worker is registered manually from router.tsx.
      injectRegister: false,
      registerType: "autoUpdate",
      // Nitro's vercel preset writes the client build straight into
      // .vercel/output/static (not the classic "dist"); without this the
      // service worker/precache manifest gets generated into an unused
      // "dist" folder and never actually ships.
      outDir: ".vercel/output/static",
      manifest: {
        name: "Limpeza de Ímãs — Nutrimilho",
        short_name: "Ímãs Nutrimilho",
        description: "Registro de limpeza de ímãs por turno e dashboards de conformidade.",
        start_url: "/dashboard",
        display: "standalone",
        background_color: "#FAFAF2",
        theme_color: "#2E7D46",
        icons: [
          { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/pwa/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        navigateFallbackDenylist: [/^\/_serverFn\//, /^\/api\//],
      },
    }),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/react-router"],
  },
});
