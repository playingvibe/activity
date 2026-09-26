import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Discord serves this app from `https://<CLIENT_ID>.discordsays.com` and enforces its own
 * Content Security Policy on every response. Two directives shape this config:
 *
 *   script-src 'self' 'unsafe-eval' 'nonce-<discord-generated>' blob:
 *   style-src  'self' 'unsafe-inline' blob:
 *
 * There is no `'unsafe-inline'` in `script-src`, and Discord's nonce is generated per
 * request, so nothing we emit can be an inline `<script>`. Inline *styles* are fine.
 * Absolute cross-origin URLs are blocked outright, so every emitted asset URL must be
 * relative and resolve under Discord's `/.proxy/` routing.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    /**
     * Testing a change inside Discord means exposing this dev server through a quick tunnel
     * (`cloudflared tunnel --url http://localhost:5173`) and pointing the app's root URL mapping at
     * it. Vite refuses any request whose `Host` header it does not recognise — a DNS-rebinding
     * defence — so without this the Activity loads *"Blocked request. This host is not allowed."*
     * inside the iframe, which looks like a Discord problem and is not one.
     *
     * Scoped to Cloudflare's quick-tunnel domain rather than `true`, which would accept any host.
     * Dev server only: `vite build` never reads this.
     */
    allowedHosts: [".trycloudflare.com"],
  },
  // Emit relative asset URLs. An absolute `/assets/...` would resolve against the proxy
  // root rather than this app's mapping.
  base: "./",
  build: {
    // Keep every asset a separate file. Inlining would emit `data:` URIs, which `script-src`
    // does not permit.
    assetsInlineLimit: 0,
    // The modulepreload polyfill is injected as an inline script — blocked by `script-src`.
    modulePreload: { polyfill: false },
    target: "es2022",
  },
});
