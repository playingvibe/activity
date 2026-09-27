import { DiscordSDK } from "@discord/embedded-app-sdk";

/**
 * Discord serves the Activity from `https://<CLIENT_ID>.discordsays.com`, so the client ID
 * is already in the hostname at runtime and needs no build-time secret plumbing. The env var
 * is the override for local `vite dev`, where the hostname is `localhost`.
 *
 * Client IDs are public (they appear in every invite URL) — this is not a secret.
 *
 * @returns the client ID, or null when it genuinely can't be determined — a plain
 *   `vite dev` on localhost with no env var set, which is exactly the App.tsx `?mock=1`
 *   case. Returning null rather than throwing matters: constructing the SDK at import
 *   time would take the entire app down on an unresolvable ID, before any caller could decide it
 *   didn't need the SDK at all.
 */
export function resolveClientId(): string | null {
  // The `?mock=1` preview has no application, so `&client=<id>` stands in for one: it shows the palette
  // that instance would have. Honoured only with `mock`, like `&background=`: a real session takes its
  // application from the hostname, never from a query string.
  const query = new URLSearchParams(window.location.search);
  const mocked = query.has("mock") ? query.get("client") : null;
  if (mocked && /^\d{17,20}$/.test(mocked)) return mocked;

  const fromEnv = import.meta.env.VITE_DISCORD_CLIENT_ID;
  if (fromEnv) return fromEnv;

  const [subdomain] = window.location.hostname.split(".");
  if (/^\d{17,20}$/.test(subdomain)) return subdomain;

  return null;
}

/**
 * Which client the Activity is running in.
 *
 * Read straight from the query param Discord puts on the iframe URL rather than from the SDK,
 * for two reasons: it is needed before any handshake to avoid a flash of the wrong layout, and
 * the SDK's own constructor throws when the param is absent — which is exactly the `?mock=1`
 * case. The SDK derives its own `platform` from this same param.
 */
export function resolvePlatform(): "mobile" | "desktop" {
  return new URLSearchParams(window.location.search).get("platform") === "mobile"
    ? "mobile"
    : "desktop";
}

let sdk: DiscordSDK | null = null;

/**
 * The SDK, constructed on first use rather than at import.
 *
 * Every caller is already gated behind "the connect sequence finished" or an equivalent
 * check, so in a real Activity session this is constructed during the handshake exactly as
 * before. Outside one — the `?mock=1` preview — nothing reaches it, and importing this
 * module is harmless instead of fatal.
 */
export function getDiscordSdk(): DiscordSDK {
  if (sdk) return sdk;

  const clientId = resolveClientId();
  if (!clientId) {
    throw new Error(
      "Could not resolve the Discord client ID. Set VITE_DISCORD_CLIENT_ID, or serve this " +
        "app from <CLIENT_ID>.discordsays.com."
    );
  }

  sdk = new DiscordSDK(clientId);
  return sdk;
}
