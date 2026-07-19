/// <reference types="vite-plugin-pwa/client" />

export function registerPwa() {
  if (typeof window === "undefined") return;
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}
