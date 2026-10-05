import { useCallback, useEffect, useRef, useState } from "react";
import { getDiscordSdk } from "./discord";
import { createSyncConnection } from "./syncConnection";
import {
  NOT_CONNECTED_NOTICE,
  describeError,
} from "./syncSupport";
import type {
  Capabilities,
  ControlAction,
  GuildContext,
  Identity,
  PlaybackState,
  Prefs,
  Profile,
  SyncStatus,
} from "./syncTypes";

// The shapes and the wording live beside the connection; these re-exports keep every import of them from here working.
export type * from "./syncTypes";
export {
  LOST_CONNECTION_TEXT,
  RECONNECTING_TEXT,
  describeError,
  errorText,
  reconnectDelay,
  waitingRetryDelay,
} from "./syncSupport";

/**
 * Everything must be relative and `/.proxy/`-prefixed — Discord's CSP blocks absolute
 * cross-origin requests outright. `/api` is the URL mapping pointing at the bot's own
 * Activity server; Discord strips that prefix before forwarding, so `/.proxy/api/token`
 * arrives at the server as `/token`.
 */
const TOKEN_ENDPOINT = "/.proxy/api/token";
const SOCKET_PATH = "/.proxy/api/ws";

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

/**
 * Per-user scopes for the iframe, requested at runtime — these are not bot permissions and
 * are deliberately absent from the bot’s invite URL.
 *
 *   identify             — know which user is driving the UI
 *   rpc.activities.write — setActivity(), for "Listening to <track>" on their profile
 *   guilds.members.read  — required by the SDK's getChannelPermissions(), which
 *                          useGuildPermissions.ts uses to decide whether to show the settings
 *                          button. Without it the call rejects with RPC 4006 ("Not authenticated or
 *                          invalid scope"), even after authorize() and authenticate() succeeded.
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

/** How long an answer to a press stays on screen. */
const NOTICE_MS = 4_000;

/**
 * Authenticates with Discord, then keeps a WebSocket open to the bot and exposes whatever
 * playback state it pushes — plus, on request, this user's own profile and (for guild
 * managers) the guild's settings. The connection itself is `createSyncConnection`; this is the React around it.
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
  // Bumped with every notice shown, so the same words twice (a second Boost) restart the timer.
  const [noticeSeq, setNoticeSeq] = useState(0);
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
  const connectionRef = useRef<ReturnType<typeof createSyncConnection> | null>(null);

  /** Shows a notice that answers something the person just did; it clears itself (`NOTICE_MS`). */
  const showNotice = useCallback((text: string) => {
    setNotice(text);
    setNoticeSeq((n) => n + 1);
  }, []);

  // Not cleared by the next state frame: the server answers a vote or a boost with the reply and then a
  // broadcast of the new state, so clearing on state erased every confirmation before it could be read.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(id);
  }, [notice, noticeSeq]);

  const sendRaw = useCallback((payload: object) => {
    const socket = connectionRef.current?.socket();
    if (socket?.readyState !== WebSocket.OPEN) {
      // Not a silent return: a button pressed during a drop would do nothing at all — no
      // rejection, no spinner — and read as a broken app.
      showNotice(NOT_CONNECTED_NOTICE);
      setNoticeAt(Date.now());
      return;
    }
    socket.send(JSON.stringify(payload));
  }, [showNotice]);

  const send = useCallback(
    (action: ControlAction, value?: number) => sendRaw({ type: "control", action, value }),
    [sendRaw]
  );

  /** Boost an upcoming track (1-indexed). The `uri` is what was on screen, so a queue that moved on since is refused. */
  const boost = useCallback(
    (position: number, uri: string | null) => sendRaw({ type: "control", action: "boost", position, uri }),
    [sendRaw]
  );

  /** Jump to an upcoming track (1-indexed). The `uri` is what was on screen, so a queue that moved on since is refused. */
  const jump = useCallback(
    (position: number, uri: string | null) => sendRaw({ type: "control", action: "jump", value: position, uri }),
    [sendRaw]
  );

  const requestProfile = useCallback(() => sendRaw({ type: "getProfile" }), [sendRaw]);

  const requestGuildContext = useCallback(() => sendRaw({ type: "getGuildContext" }), [sendRaw]);

  useEffect(() => {
    if (!enabled) return;

    const connection = createSyncConnection(
      {
        sdk: {
          ready: () => getDiscordSdk().ready(),
          get guildId() {
            return getDiscordSdk().guildId;
          },
          authorize,
          authenticate: (accessToken) => getDiscordSdk().commands.authenticate({ access_token: accessToken }),
        },
        fetch: (input, init) => fetch(input, init),
        tokenEndpoint: TOKEN_ENDPOINT,
        openSocket: () => new WebSocket(`wss://${window.location.host}${SOCKET_PATH}`),
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
        random: Math.random,
        now: Date.now,
        visibility: {
          hidden: () => document.visibilityState === "hidden",
          listen: (fn) => {
            document.addEventListener("visibilitychange", fn);
            return () => document.removeEventListener("visibilitychange", fn);
          },
        },
      },
      {
        status: setStatus,
        identity: setIdentity,
        profile: setProfile,
        prefs: setPrefs,
        guildContext: setGuildContext,
        capabilities: setCapabilities,
        notice: showNotice,
        clearNotice: () => setNotice(null),
        connectionRestored: () => setNotice((current) => (current === NOT_CONNECTED_NOTICE ? null : current)),
        rejected: () => setNoticeAt(Date.now()),
      }
    );
    connectionRef.current = connection;
    connection.start();

    return () => connection.dispose();
  }, [enabled, showNotice]);

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
    jump,
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

  return projectPosition(state, now, live);
}

/**
 * Where the track is at `now`, extrapolated from the last frame. Both ends of the subtraction are this
 * machine's clock (`receivedAt`): the server's `sampledAt` is on another clock, and a viewer whose own
 * was a few seconds slow or fast saw the bar freeze or run ahead of the song for the whole track.
 */
export function projectPosition(state: PlaybackState | null, now: number, live = true): number {
  if (!state?.connected) return 0;

  const base = state.positionMs ?? 0;
  if (state.paused || !live) return base;

  const elapsed = Math.max(0, now - (state.receivedAt ?? state.sampledAt));
  const length = state.track?.lengthMs;
  const projected = base + elapsed;

  return length ? Math.min(projected, length) : projected;
}
