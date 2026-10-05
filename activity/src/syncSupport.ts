// What the connection and the hook both need and neither owns: timing, wording, error codes.

/**
 * Reconnect timing: the delay doubles from 2 s to a 30 s cap with jitter, so clients that dropped together do
 * not return together (each retry costs the server a Discord lookup), and after `MAX_RECONNECT_ATTEMPTS`
 * failures in a row the player says so and stops.
 */
const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;
export const MAX_RECONNECT_ATTEMPTS = 8;

/**
 * Waiting for somebody to join the voice channel is not a failure, so it neither backs off nor
 * gives up. The server closes a refused socket ten seconds after it opens, so with this each waiting
 * player says hello about once every fourteen seconds: roughly four a minute, against the server's limit of
 * twenty a minute per address.
 */
const WAITING_RETRY_MS = 4_000;

/**
 * The wait between attempts while the viewer has not joined voice yet: flat, but spread, so every
 * waiting client does not come back at the same instant after a bot restart.
 */
export function waitingRetryDelay(random: () => number = Math.random): number {
  return Math.round(WAITING_RETRY_MS * (0.5 + random()));
}

export const NOT_IN_SERVER_TEXT =
  "Vibe's player opens from a voice channel in a server. Start it there instead.";
export const RECONNECTING_TEXT = "Lost the connection to Vibe. Reconnecting…";
export const LOST_CONNECTION_TEXT =
  "Couldn't reconnect to Vibe. Close and reopen the Activity to try again.";

/**
 * The delay before reconnect attempt `attempt` (0-based): doubling from `RECONNECT_BASE_MS`, capped,
 * then scaled by 0.5–1.5 so clients that dropped together do not all return together.
 */
export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const capped = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
  return Math.round(capped * (0.5 + random()));
}

/**
 * The Embedded App SDK rejects with plain RPC payloads ({code, message}) rather than Error
 * instances, so `String(error)` collapses them to "[object Object]" and throws away the
 * only useful information. Dig out whatever is actually in there.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    const parts = [e.message, e.error, e.code].filter(Boolean).map(String);
    if (parts.length) return parts.join(" · ");
    try {
      return JSON.stringify(error);
    } catch {
      return "unserialisable error";
    }
  }

  return String(error);
}

/**
 * Every error code the Activity server can send, socket frames and the token exchange alike.
 *
 * **Exhaustive on purpose.** A `Record` over the union means a code listed here without text fails
 * `tsc`, and `tests/activityErrorText.test.js` fails the suite when the server can send a code that
 * is not listed, so a code never reaches the notice banner as a raw identifier like `bad_json`.
 */
type ServerErrorCode =
  | "already_authenticated"
  | "already_next"
  | "bad_hello"
  | "bad_json"
  | "bad_request"
  | "blocked"
  | "discord_unavailable"
  | "exchange_failed"
  | "internal_error"
  | "invalid_token"
  | "missing_code"
  | "not_authenticated"
  | "not_authorized"
  | "not_dj"
  | "not_found"
  | "not_in_voice_channel"
  | "nothing_playing"
  | "queue_changed"
  | "rate_limited"
  | "server_not_configured"
  | "too_large"
  | "unknown_action";

/** A sign-in failure worth retrying: Discord slow, rate limiting or briefly unreachable, as opposed to refusing. */
export class TransientConnectError extends Error {}

export const NOT_CONNECTED_NOTICE = "Not connected to Vibe right now.";

const ERROR_TEXT: Record<ServerErrorCode, string> = {
  not_in_voice_channel: "Join the voice channel Vibe is playing in to control playback.",
  invalid_token: "Discord rejected the session. Try reopening the Activity.",
  server_not_configured: "The bot is missing its Activity configuration.",
  exchange_failed: "Could not complete Discord sign-in.",
  missing_code: "Could not complete Discord sign-in.",
  rate_limited: "Slow down a moment.",
  not_authorized: "You need the Manage Server permission to change settings.",
  not_dj: "Only a DJ can control playback here.",
  blocked: "You've been blocked from using Vibe in this server.",
  discord_unavailable: "Discord isn't answering right now. Vibe will keep trying.",
  too_large: "Vibe couldn't accept that request. Try reopening the Activity.",
  nothing_playing: "Nothing is playing right now.",
  already_next: "That track is already next.",
  queue_changed: "The queue changed. Try again.",
  already_authenticated: "This player is already connected.",
  bad_hello: "Vibe couldn't read this player's sign-in. Try reopening the Activity.",
  bad_json: "Vibe couldn't read that request. Try again.",
  bad_request: "Vibe couldn't read that request. Try reopening the Activity.",
  internal_error: "Something went wrong on Vibe's side. Try again in a moment.",
  not_authenticated: "Still signing in. Try again in a moment.",
  not_found: "That isn't available.",
  unknown_action: "That isn't supported here. Try reopening the Activity.",
};

/** User-facing text for a server error code — never the code itself. */
export function errorText(code: unknown): string {
  return typeof code === "string" && Object.hasOwn(ERROR_TEXT, code)
    ? ERROR_TEXT[code as ServerErrorCode]
    : "Something went wrong. Try again.";
}
