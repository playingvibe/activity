import { useCallback, useEffect, useRef, useState } from "react";
import { getDiscordSdk } from "./discord";
import { isCardBackground } from "./generated/cardBackgrounds";

export type Track = {
  title: string | null;
  author: string | null;
  uri: string | null;
  thumbnail: string | null;
  lengthMs: number | null;
  isStream: boolean;
  requesterId: string | null;
  requesterName: string | null;
  /** Upcoming tracks only: how many listeners have boosted this one. Absent from an older bot. */
  boosts?: number;
};

export type PlaybackState = {
  type: "state";
  guildId: string;
  connected: boolean;
  paused?: boolean;
  voiceChannelId?: string | null;
  positionMs?: number;
  sampledAt: number;
  volume?: number | null;
  repeatMode?: "off" | "track" | "queue";
  track?: Track | null;
  /** At most the first 50 upcoming tracks. */
  queue?: Track[];
  /** The real number of upcoming tracks, which `queue` may be cut short of. */
  queueLength?: number;
  /** How many boosts make a track move to next. Absent from an older bot. */
  boostRequired?: number;
};

export type ControlAction =
  | "pause"
  | "resume"
  | "skip"
  | "previous"
  | "seek"
  | "volume"
  | "jump"
  | "shuffle"
  | "loop";

/** Server-computed hint for whether this viewer may drive playback. The server re-checks for
 * real on every control message, so this only decides whether the UI offers the buttons. */
export type Capabilities = { canControl: boolean };

/**
 * - `connecting` — no state yet. `reason` says why it is still waiting, when the server said.
 * - `ready` — the socket is live and `state` is current.
 * - `stale` — `state` is the last thing received, and it is **not live**: the socket dropped, or the
 *   server stopped the feed because this user left the voice channel. The player stays on screen,
 *   frozen, under `reason`, with its controls disabled.
 * - `error` — nothing more will happen without reopening the Activity.
 */
export type SyncStatus =
  | { phase: "connecting"; reason?: string | null }
  | { phase: "ready"; state: PlaybackState }
  | { phase: "stale"; state: PlaybackState; reason: string }
  | { phase: "error"; error: string };

/** The signed-in user, captured from authenticate()'s own response — no separate fetch. */
export type Identity = {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
};

export type ProfileStats = {
  totalListeningTime: number;
  currentStreak: number;
  longestStreak: number;
  /** Tracks credited with listening time. Absent from an older server. */
  sessionCount?: number;
};

/** Where the listener is on the level curve: `remainingMs` is null at the top level. */
export type ProfileLevel = { level: number; progress: number; remainingMs: number | null };

/** An earned badge tier: the name and its colour, as `/rank` shows them. */
export type ProfileBadge = { name: string; color: string };

/**
 * `plan` is always null today. Entitlements are mirrored onto the user (see the bot's
 * `EntitlementService`), but the profile panel does not surface premium yet.
 */
export type Profile = {
  stats: ProfileStats;
  /** `level` and `badges` are absent when the bot is older than this panel (the two deploy apart). */
  level?: ProfileLevel;
  badges?: ProfileBadge[];
  plan: null;
};

/** Sent once at connect, not with the profile — see ActivityServer's comment on why. */
export type Prefs = { accent: string | null; background: string | null };

export type GuildRole = { id: string; name: string; color: string };
export type GuildChannel = { id: string; name: string; kind: "text" | "voice" };
export type GuildConfig = {
  djRoles: string[];
  voiceChannels: string[];
  commandsChannels: string[];
  logChannelId: string | null;
  announcements: boolean;
  autoplay: boolean;
  autoplayRoomTaste: boolean;
  /** Counted, not listed: who a server has blocked is not something this panel publishes. */
  blockedUserCount: number;
  blockedRoleCount: number;
};

export type GuildContext = {
  /** **This bot's effective settings** — the server's document with this bot's overrides applied. */
  config: GuildConfig;
  /** Which of those values are this bot's own rather than the server's. */
  overridden: string[];
  roles: GuildRole[];
  channels: GuildChannel[];
};

/**
 * Everything must be relative and `/.proxy/`-prefixed — Discord's CSP blocks absolute
 * cross-origin requests outright. `/api` is the URL mapping pointing at the bot's own
 * Activity server; Discord strips that prefix before forwarding, so `/.proxy/api/token`
 * arrives at the server as `/token`.
 */
const TOKEN_ENDPOINT = "/.proxy/api/token";
const SOCKET_PATH = "/.proxy/api/ws";

/**
 * Reconnect timing. It was a flat 2 s retry, forever: every open Activity retried in lockstep after a
 * bot restart, each retry costing the server a Discord lookup, and a client that could never succeed
 * retried invisibly for as long as it was open. Now the delay doubles from 2 s to a 30 s cap with
 * jitter, and after `MAX_RECONNECT_ATTEMPTS` failures in a row the player says so and stops.
 */
const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 8;

/**
 * Waiting for somebody to join the voice channel is not a failure, so it neither backs off nor
 * gives up. The server closes a refused socket ten seconds after it opens, so with this each waiting
 * player says hello about once every fourteen seconds: roughly four a minute, slightly under the old
 * flat retry, against the server's limit of twenty a minute per address.
 */
const WAITING_RETRY_MS = 4_000;

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
 * Per-user scopes for the iframe, requested at runtime — these are not bot permissions and
 * are deliberately absent from the bot’s invite URL.
 *
 *   identify             — know which user is driving the UI
 *   rpc.activities.write — setActivity(), for "Listening to <track>" on their profile
 *   guilds.members.read  — required by the SDK's getChannelPermissions(), which
 *                          useGuildPermissions.ts uses to decide whether to show the settings
 *                          button. Confirmed against Discord's own docs after seeing this
 *                          exact call reject with "Not authenticated or invalid scope" (RPC
 *                          4006) *after* authorize()+authenticate() had already succeeded —
 *                          proving it was a missing scope, not an ordering problem.
 *
 * `guilds` is deliberately absent: the SDK already supplies guildId and channelId.
 *
 * Rich presence and the settings-button hint are both nice-to-haves, so neither is
 * load-bearing: if the extended scopes are refused, fall back to `identify` alone rather than
 * failing the whole Activity.
 *
 * `prompt` is typed as accepting only `"none"` — per the SDK's own doc comment, that does
 * NOT mean no consent UI is possible: "If the user does not yet have a valid token for all
 * scopes requested, this command will open an OAuth modal." So a scope being refused here is
 * a genuine rejection, not `prompt: "none"` silently blocking a modal.
 */
/**
 * Discord's RPC refuses a second `authorize` while one is still in flight for the frame, with
 * code 4002 ("Already authing"). It is a concurrency answer, never a consent or scope answer, and
 * the two are worth telling apart: a scope refusal should fall back to fewer scopes, while this
 * should simply wait for the flow already running.
 */
function isAlreadyAuthing(error: unknown): boolean {
  const text = describeError(error);
  return text.includes("4002") || /already\s+authing/i.test(text);
}

const AUTHORIZE_RETRY_MS = 600;
const AUTHORIZE_RETRIES = 3;

/**
 * The authorize currently in flight, shared by every caller.
 *
 * **Module-level rather than per-effect**, because the callers that collide are in different
 * effect runs: React StrictMode mounts twice in development, and reopening the Activity in a
 * client that still holds the previous frame's flow does the same thing in production. Both
 * surface as `Failed during authorize: Already authing · 4002` on the second launch, where leaving
 * `/watch` and reopening it never reaches the loading vector. Cleared when it settles, so a later
 * launch starts a fresh flow.
 */
let inFlightAuthorize: Promise<{ code: string }> | null = null;

async function authorize(): Promise<{ code: string }> {
  if (inFlightAuthorize) return inFlightAuthorize;
  inFlightAuthorize = runAuthorize().finally(() => {
    inFlightAuthorize = null;
  });
  return inFlightAuthorize;
}

async function runAuthorize(): Promise<{ code: string }> {
  // **No `redirect_uri`, and that is a dependency rather than an oversight.** The Embedded App
  // SDK omits it and Discord falls back to the application's single registered redirect URI — so
  // the app must have **exactly one** under OAuth2 → Redirects (`https://127.0.0.1` works). Zero
  // gives `invalid_request: Missing "redirect_uri" in request` at authorize.
  // More than one is ambiguous and fails the same way. If a second is ever needed, this call has
  // to start sending one explicitly, and it must match the portal exactly.
  const base = {
    client_id: getDiscordSdk().clientId,
    response_type: "code" as const,
    state: "",
    prompt: "none" as const,
  };

  // One flow at a time is Discord's rule, so a 4002 is waited out rather than answered with a
  // second call — retrying with fewer scopes here would be a *third* authorize on the same frame
  // and would fail for the same reason, which would make this worse.
  for (let attempt = 0; ; attempt += 1) {
    try {
      // Spelled out at the call site rather than hoisted into a variable: the scope list is
      // contextually typed as the SDK's own `OAuthScopes[]` here, and a `const` would widen it to
      // `string[]` and stop compiling.
      return await getDiscordSdk().commands.authorize({
        ...base,
        scope: ["identify", "rpc.activities.write", "guilds.members.read"],
      });
    } catch (error) {
      if (isAlreadyAuthing(error)) {
        if (attempt >= AUTHORIZE_RETRIES) throw error;
        console.warn(`[vibe] authorize already in flight, retrying (${attempt + 1})`);
        await new Promise((resolve) => setTimeout(resolve, AUTHORIZE_RETRY_MS));
        continue;
      }

      console.warn(
        `[vibe] extended scopes refused, retrying with identify only: ${describeError(error)}`,
        error
      );
      return await getDiscordSdk().commands.authorize({ ...base, scope: ["identify"] });
    }
  }
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
  | "already_exists"
  | "already_next"
  | "bad_hello"
  | "bad_json"
  | "bad_value"
  | "exchange_failed"
  | "internal_error"
  | "invalid_token"
  | "limit_reached"
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
  | "unknown_action";

const ERROR_TEXT: Record<ServerErrorCode, string> = {
  not_in_voice_channel: "Join the voice channel Vibe is playing in to control playback.",
  invalid_token: "Discord rejected the session. Try reopening the Activity.",
  server_not_configured: "The bot is missing its Activity configuration.",
  exchange_failed: "Could not complete Discord sign-in.",
  missing_code: "Could not complete Discord sign-in.",
  rate_limited: "Slow down a moment.",
  not_authorized: "You need the Manage Server permission to change settings.",
  not_dj: "Only a DJ can control playback here.",
  nothing_playing: "Nothing is playing right now.",
  already_next: "That track is already next.",
  queue_changed: "The queue changed. Try again.",
  already_exists: "That's already set.",
  limit_reached: "The list is full.",
  bad_value: "That value wasn't valid.",
  already_authenticated: "This player is already connected.",
  bad_hello: "Vibe couldn't read this player's sign-in. Try reopening the Activity.",
  bad_json: "Vibe couldn't read that request. Try again.",
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

/**
 * Authenticates with Discord, then keeps a WebSocket open to the bot and exposes whatever
 * playback state it pushes — plus, on request, this user's own profile and (for guild
 * managers) the guild's settings.
 *
 * Audio is *not* played here — it comes from the bot's own voice connection. This is a
 * control surface, so the socket is the only source of truth and the UI never guesses.
 *
 * `enabled: false` skips the Discord handshake and the socket entirely and just returns the
 * initial (disconnected) state. That exists for the `?mock=1` preview in App.tsx: hooks can't
 * be called conditionally, so mock mode still calls this — it just must not fire off a
 * handshake that can only ever fail outside a real Activity session.
 */
export function useActivitySync(enabled = true) {
  const [status, setStatus] = useState<SyncStatus>({ phase: "connecting" });
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped alongside every `notice` — a rejected control (e.g. a non-DJ's seek/volume drag)
  // never produces its own state broadcast, so a held slider (see HeldRange in Player.tsx)
  // has nothing to reset it back to the real position on rejection. Combined into those
  // sliders' resetKey so a rejection snaps them back immediately instead of leaving the thumb
  // wherever the user dragged it until some unrelated broadcast happens to arrive.
  const [noticeAt, setNoticeAt] = useState(0);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [guildContext, setGuildContext] = useState<GuildContext | null>(null);
  // Defaults to true so the controls are never wrongly disabled on an older server that
  // doesn't send this message — the server is the real gate either way.
  const [capabilities, setCapabilities] = useState<Capabilities>({ canControl: true });
  const socketRef = useRef<WebSocket | null>(null);
  const closedByUs = useRef(false);

  const sendRaw = useCallback((payload: object) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) {
      // Not a silent return: a button pressed during a drop would do nothing at all — no
      // rejection, no spinner — and read as a broken app.
      setNotice("Not connected to Vibe right now.");
      setNoticeAt(Date.now());
      return;
    }
    socket.send(JSON.stringify(payload));
  }, []);

  const send = useCallback(
    (action: ControlAction, value?: number) => sendRaw({ type: "control", action, value }),
    [sendRaw]
  );

  /** Boost an upcoming track (1-indexed). The `uri` is what was on screen, so a queue that moved on since is refused. */
  const boost = useCallback(
    (position: number, uri: string | null) => sendRaw({ type: "control", action: "boost", position, uri }),
    [sendRaw]
  );

  const requestProfile = useCallback(() => sendRaw({ type: "getProfile" }), [sendRaw]);

  const requestGuildContext = useCallback(() => sendRaw({ type: "getGuildContext" }), [sendRaw]);

  useEffect(() => {
    if (!enabled) return;

    // **Scoped to this connection, not the component's lifetime.** It is set in the cleanup below
    // and was never reset, so after any remount — and from the very first render under React's
    // development StrictMode, which mounts twice — the close handler returned early forever and the
    // player could never reconnect.
    closedByUs.current = false;

    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let visibilityListener: (() => void) | null = null;
    let stage = "startup";
    // Consecutive failed connections. Reset by the first state frame on a socket.
    let attempts = 0;
    // The last state received, shown frozen while the player is not live.
    let lastState: PlaybackState | null = null;
    // One fresh token per run of failures, so a Discord that keeps refusing cannot loop authorize().
    let tokenRefreshed = false;
    // The server's last refusal was "not in the voice channel": keep retrying, patiently.
    let waitingForVoice = false;
    // Nothing more should be attempted until the Activity is reopened.
    let fatal = false;
    // **This run's own tombstone.** `closedByUs` is one ref shared by every run, and the next run resets
    // it, so under StrictMode's double mount the discarded first run looked alive again: its sign-in
    // failing after the cleanup flashed "Failed during token exchange" over the second run's healthy
    // connection, and it could open a socket of its own. Set only by this run's cleanup, never reset.
    let disposed = false;

    const fail = (error: string) => {
      if (disposed) return;
      fatal = true;
      setStatus({ phase: "error", error });
      socketRef.current?.close();
    };

    async function connect() {
      stage = "SDK handshake";
      await getDiscordSdk().ready();
      if (disposed) return;

      stage = "authorize";
      const { code } = await authorize();
      if (disposed) return;

      stage = "token exchange";
      const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body.error ? errorText(body.error) : `Sign-in failed (HTTP ${response.status})`
        );
      }

      const { access_token: accessToken } = await response.json();
      if (disposed) return;

      stage = "authenticate";
      const auth = await getDiscordSdk().commands.authenticate({ access_token: accessToken });
      if (disposed) return;
      setIdentity({
        id: auth.user.id,
        username: auth.user.username,
        globalName: auth.user.global_name ?? null,
        avatarUrl: auth.user.avatar
          ? `https://cdn.discordapp.com/avatars/${auth.user.id}/${auth.user.avatar}.png`
          : null,
      });

      stage = "socket";

      openSocket(accessToken);
    }

    function reportConnectFailure(error: unknown) {
      if (disposed) return;
      console.error(`[vibe] failed during ${stage}: ${describeError(error)}`, error);
      fail(`Failed during ${stage}: ${describeError(error)}`);
    }

    function scheduleReconnect(accessToken: string) {
      if (closedByUs.current || fatal || disposed) return;

      let delay: number;
      if (waitingForVoice) {
        delay = WAITING_RETRY_MS;
      } else {
        if (attempts >= MAX_RECONNECT_ATTEMPTS) return fail(LOST_CONNECTION_TEXT);
        delay = reconnectDelay(attempts);
        attempts += 1;
      }

      const retry = () => {
        if (!closedByUs.current && !fatal && !disposed) openSocket(accessToken);
      };

      reconnectTimer = setTimeout(() => {
        // A hidden Activity waits until it is visible again rather than retrying unseen.
        if (document.visibilityState !== "hidden") return retry();
        visibilityListener = () => {
          if (document.visibilityState === "hidden") return;
          document.removeEventListener("visibilitychange", visibilityListener!);
          visibilityListener = null;
          retry();
        };
        document.addEventListener("visibilitychange", visibilityListener);
      }, delay);
    }

    function openSocket(accessToken: string) {
      const socket = new WebSocket(`wss://${window.location.host}${SOCKET_PATH}`);
      socketRef.current = socket;
      // Whether the server accepted this socket's hello, which is what separates a refused hello
      // from a rejected control later on. It stays true through an `unsubscribed` frame: the
      // session is still authenticated, so a refusal after that is still only a notice.
      let accepted = false;
      // Set while this socket is closed on purpose to fetch a fresh token.
      let replacing = false;

      socket.addEventListener("open", () => {
        socket.send(
          JSON.stringify({ type: "hello", accessToken, guildId: getDiscordSdk().guildId })
        );
      });

      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);

        if (message.type === "state") {
          accepted = true;
          attempts = 0;
          tokenRefreshed = false;
          waitingForVoice = false;
          lastState = message;
          setNotice(null);
          setStatus({ phase: "ready", state: message });
          return;
        }

        if (message.type === "unsubscribed") {
          // The server stopped the feed, because this user left the voice channel. It resumes by
          // itself — with a state frame — when they rejoin.
          const reason = errorText(message.reason);
          setStatus(lastState ? { phase: "stale", state: lastState, reason } : { phase: "connecting", reason });
          return;
        }

        if (message.type === "profile") {
          setProfile({ stats: message.stats, level: message.level, badges: message.badges, plan: message.plan });
          return;
        }

        if (message.type === "guildContext") {
          setNotice(null);
          setGuildContext({
            config: message.config,
            // An older server sends no `overridden` list; an empty one simply means no badges,
            // which is the honest rendering of "this build cannot tell".
            overridden: Array.isArray(message.overridden) ? message.overridden : [],
            roles: message.roles,
            channels: message.channels,
          });
          return;
        }

        if (message.type === "prefs") {
          setPrefs({
            // Validated like its sibling below, rather than trusted as any string: it becomes a CSS
            // custom property that the whole palette is derived from, so a malformed value would
            // silently collapse every colour that mixes it.
            accent: /^#[0-9a-f]{6}$/i.test(message.accent) ? message.accent : null,
            // An allow-list, not a passthrough: this value becomes a CSS class, so an unknown
            // string would silently do nothing while the settings page claimed otherwise.
            //
            // The keys are **generated** from the bot's own registry rather than written here. The
            // literal union this replaced was correct for two styles and would have been quietly
            // wrong for a third: a background the user had chosen and the rank card was drawing
            // would have been dropped on the floor by the player, with nothing reporting it.
            background: isCardBackground(message.background) ? message.background : null,
          });
          return;
        }

        if (message.type === "capabilities") {
          setCapabilities({ canControl: message.canControl !== false });
          return;
        }

        if (message.type === "voteSkip") {
          setNotice(
            message.skipped
              ? "Vote passed. Skipping."
              : message.alreadyVoted
                ? `You already voted (${message.votes}/${message.required}).`
                : `Vote to skip registered (${message.votes}/${message.required}).`
          );
          return;
        }

        if (message.type === "voteBoost") {
          setNotice(
            message.moved
              ? message.direct
                ? "Moved up next."
                : "Vote passed. Playing next."
              : message.alreadyVoted
                ? `You already boosted it (${message.votes}/${message.required}).`
                : `Boost registered (${message.votes}/${message.required}).`
          );
          return;
        }

        if (message.type !== "error") return;

        // **Before any state, an error is the server refusing this socket's hello**, and there is no
        // working view for a notice to sit on. A notice here would never render on the
        // connecting screen, and the user would watch "Connecting…" forever.
        if (!accepted) {
          if (message.error === "invalid_token") {
            // Most likely a token that expired while the Activity sat open. Fetch a fresh one once;
            // replaying the old token on every reconnect could never have succeeded.
            if (tokenRefreshed) return fail(errorText(message.error));
            tokenRefreshed = true;
            replacing = true;
            socket.close();
            connect().catch(reportConnectFailure);
            return;
          }
          if (message.error === "not_in_voice_channel" || message.error === "rate_limited") {
            // Worth waiting out. The server closes the socket, and the close handler retries.
            waitingForVoice = message.error === "not_in_voice_channel";
            const reason = errorText(message.error);
            setStatus(lastState ? { phase: "stale", state: lastState, reason } : { phase: "connecting", reason });
            return;
          }
          return fail(errorText(message.error));
        }

        // After state, a rejection is transient — a refused control or setting — and must not
        // tear down a working view, so it becomes a notice.
        setNotice(errorText(message.error));
        // A rejected control (e.g. a non-DJ's seek/volume drag getting a "not_dj" back)
        // never triggers its own state broadcast, so nothing else would ever tell a held
        // slider to let go of the locally-dragged value it optimistically showed — see
        // `noticeAt`'s own comment.
        setNoticeAt(Date.now());
      });

      socket.addEventListener("close", () => {
        if (closedByUs.current || replacing || fatal || disposed) return;
        // **Say so.** Otherwise the player stays on screen looking live — the progress bar running
        // on, every button silently doing nothing — until the reconnect happens to succeed.
        if (lastState && !waitingForVoice) {
          setStatus({ phase: "stale", state: lastState, reason: RECONNECTING_TEXT });
        }
        scheduleReconnect(accessToken);
      });
    }

    connect().catch(reportConnectFailure);

    return () => {
      disposed = true;
      closedByUs.current = true;
      clearTimeout(reconnectTimer);
      if (visibilityListener) document.removeEventListener("visibilitychange", visibilityListener);
      socketRef.current?.close();
    };
  }, [enabled]);

  return {
    status,
    notice,
    noticeAt,
    identity,
    profile,
    prefs,
    guildContext,
    capabilities,
    send,
    boost,
    requestProfile,
    requestGuildContext,
  };
}

/** The full shape `useActivitySync` returns — what Player accepts as a `sync` override. */
export type ActivitySync = ReturnType<typeof useActivitySync>;

/**
 * The server pairs `positionMs` with the moment it was sampled, so the client advances the
 * clock itself between pushes. Without this a progress bar would only move when the server
 * happened to broadcast, which is event-driven and therefore irregular.
 *
 * `live: false` freezes it at the last sample. A player that has lost its connection would
 * otherwise keep advancing past the real position until it pegged at the end of the track.
 */
export function useLivePosition(state: PlaybackState | null, live = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!live || !state?.connected || state.paused) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [live, state?.connected, state?.paused]);

  if (!state?.connected) return 0;

  const base = state.positionMs ?? 0;
  if (state.paused || !live) return base;

  const elapsed = Math.max(0, now - state.sampledAt);
  const length = state.track?.lengthMs;
  const projected = base + elapsed;

  return length ? Math.min(projected, length) : projected;
}
