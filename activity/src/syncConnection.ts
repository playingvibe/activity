import { isCardBackground } from "./generated/cardBackgrounds";
import {
  LOST_CONNECTION_TEXT,
  MAX_RECONNECT_ATTEMPTS,
  NOT_IN_SERVER_TEXT,
  RECONNECTING_TEXT,
  TransientConnectError,
  describeError,
  errorText,
  reconnectDelay,
  waitingRetryDelay,
} from "./syncSupport";
import type {
  Capabilities,
  GuildContext,
  Identity,
  PlaybackState,
  Prefs,
  Profile,
  SyncStatus,
} from "./syncTypes";

/**
 * The connection itself, with no React in it: signing in, the socket, the reconnect backoff and what each frame
 * means. `useActivitySync` is the thin layer that turns its callbacks into state. Everything the outside world
 * provides (the SDK, `fetch`, the socket, timers, the clock, the visibility of the page) comes in through
 * `SyncDeps`, so a test can drive a whole outage on a fake clock.
 */

/** The part of a `WebSocket` the connection uses. */
export type SyncSocket = {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener(type: "open" | "message" | "close", listener: (event: { data?: string }) => void): void;
};

type AuthUser = { id: string; username: string; global_name?: string | null; avatar?: string | null };

export type SyncDeps = {
  sdk: {
    ready(): Promise<unknown>;
    /** Read when the hello is sent, so it is whatever the SDK says then. */
    readonly guildId: string | null;
    authorize(): Promise<{ code: string }>;
    authenticate(accessToken: string): Promise<{ user: AuthUser }>;
  };
  fetch: typeof fetch;
  tokenEndpoint: string;
  openSocket(): SyncSocket;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  random: () => number;
  now: () => number;
  /** Whether the Activity is on screen, and a way to hear when it comes back. `listen` returns the way to stop. */
  visibility: { hidden(): boolean; listen(fn: () => void): () => void };
};

/** What the connection reports; the hook turns each into React state. */
export type SyncEvents = {
  status(status: SyncStatus): void;
  identity(identity: Identity): void;
  profile(profile: Profile): void;
  prefs(prefs: Prefs): void;
  guildContext(context: GuildContext): void;
  capabilities(capabilities: Capabilities): void;
  /** An answer to something the person just did. */
  notice(text: string): void;
  /** Drops whatever notice is showing. */
  clearNotice(): void;
  /** The connection is back, so a "not connected" notice is over (and no other notice is touched). */
  connectionRestored(): void;
  /** A control or setting was refused: a held slider should let go of the value it optimistically showed. */
  rejected(): void;
};

/** The prefs frame as the player may trust it. */
export function prefsFromFrame(message: { accent?: unknown; background?: unknown }): Prefs {
  return {
    // Validated like its sibling below, rather than trusted as any string: it becomes a CSS
    // custom property that the whole palette is derived from, so a malformed value would
    // silently collapse every colour that mixes it.
    accent: typeof message.accent === "string" && /^#[0-9a-f]{6}$/i.test(message.accent) ? message.accent : null,
    // An allow-list, not a passthrough: this value becomes a CSS class, so an unknown
    // string would silently do nothing while the settings page claimed otherwise.
    //
    // The keys are **generated** from the bot's own registry rather than written here.
    background: isCardBackground(message.background) ? message.background : null,
  };
}

type VoteFrame = { skipped?: boolean; moved?: boolean; direct?: boolean; alreadyVoted?: boolean; votes?: number; required?: number };

export function voteSkipNotice(message: VoteFrame): string {
  return message.skipped
    ? "Vote passed. Skipping."
    : message.alreadyVoted
      ? `You already voted (${message.votes}/${message.required}).`
      : `Vote to skip registered (${message.votes}/${message.required}).`;
}

export function voteBoostNotice(message: VoteFrame): string {
  return message.moved
    ? message.direct
      ? "Moved up next."
      : "Vote passed. Playing next."
    : message.alreadyVoted
      ? `You already boosted it (${message.votes}/${message.required}).`
      : `Boost registered (${message.votes}/${message.required}).`;
}

/**
 * Signs in and keeps one socket to the bot open, reconnecting with backoff. One instance is one run: `dispose()`
 * ends it for good, and a new run (React remounting) makes a new one.
 */
export function createSyncConnection(deps: SyncDeps, events: SyncEvents) {
  let currentSocket: SyncSocket | null = null;
  let reconnectTimer: unknown;
  let stopWatchingVisibility: (() => void) | null = null;
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
  // **This run's own tombstone.** Set only by this run's `dispose()`, never reset: a discarded run (the first
  // mount of StrictMode's double mount) must not report errors or open a socket.
  let disposed = false;

  const fail = (error: string) => {
    if (disposed) return;
    fatal = true;
    events.status({ phase: "error", error });
    currentSocket?.close();
  };

  async function connect() {
    stage = "SDK handshake";
    await deps.sdk.ready();
    if (disposed) return;

    // Launched somewhere with no server (a DM or a group call): there is no guild to join the room of, the server
    // would answer `bad_hello`, and the fatal "try reopening" that follows could never be right.
    if (!deps.sdk.guildId) return fail(NOT_IN_SERVER_TEXT);

    stage = "authorize";
    const { code } = await deps.sdk.authorize();
    if (disposed) return;

    stage = "token exchange";
    const response = await deps
      .fetch(deps.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      .catch((error) => {
        // The request never got an answer (offline for a moment, the tunnel restarting).
        throw new TransientConnectError(describeError(error));
      });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = body.error ? errorText(body.error) : `Sign-in failed (HTTP ${response.status})`;
      // A rate limit or a server error says nothing about this sign-in: try again, with backoff.
      if (response.status === 429 || response.status >= 500) throw new TransientConnectError(message);
      throw new Error(message);
    }

    const { access_token: accessToken } = await response.json();
    if (disposed) return;

    stage = "authenticate";
    const auth = await deps.sdk.authenticate(accessToken);
    if (disposed) return;
    events.identity({
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

  /** `connect()`, retried with the reconnect backoff when the failure is Discord being slow rather than no. */
  function connectWithRetry() {
    connect().catch((error) => {
      if (disposed) return;
      if (error instanceof TransientConnectError && attempts < MAX_RECONNECT_ATTEMPTS) {
        events.status({ phase: "connecting", reason: errorText("discord_unavailable") });
        const delay = reconnectDelay(attempts, deps.random);
        attempts += 1;
        reconnectTimer = deps.setTimeout(() => {
          if (!disposed) connectWithRetry();
        }, delay);
        return;
      }
      reportConnectFailure(error);
    });
  }

  function reportConnectFailure(error: unknown) {
    if (disposed) return;
    console.error(`[vibe] failed during ${stage}: ${describeError(error)}`, error);
    fail(`Failed during ${stage}: ${describeError(error)}`);
  }

  function scheduleReconnect(accessToken: string) {
    if (fatal || disposed) return;

    let delay: number;
    if (waitingForVoice) {
      delay = waitingRetryDelay(deps.random);
    } else {
      if (attempts >= MAX_RECONNECT_ATTEMPTS) return fail(LOST_CONNECTION_TEXT);
      delay = reconnectDelay(attempts, deps.random);
      attempts += 1;
    }

    const retry = () => {
      if (!fatal && !disposed) openSocket(accessToken);
    };

    reconnectTimer = deps.setTimeout(() => {
      // A hidden Activity waits until it is visible again rather than retrying unseen.
      if (!deps.visibility.hidden()) return retry();
      stopWatchingVisibility = deps.visibility.listen(() => {
        if (deps.visibility.hidden()) return;
        stopWatchingVisibility?.();
        stopWatchingVisibility = null;
        retry();
      });
    }, delay);
  }

  function openSocket(accessToken: string) {
    const socket = deps.openSocket();
    currentSocket = socket;
    // Whether the server accepted this socket's hello, which is what separates a refused hello
    // from a rejected control later on. It stays true through an `unsubscribed` frame: the
    // session is still authenticated, so a refusal after that is still only a notice.
    let accepted = false;
    // Set while this socket is closed on purpose to fetch a fresh token.
    let replacing = false;
    // Whether the server said anything at all on this socket. A socket that closes without a word never
    // reached it, whatever the last refusal was.
    let heardFromServer = false;

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "hello", accessToken, guildId: deps.sdk.guildId }));
    });

    socket.addEventListener("message", (event) => {
      heardFromServer = true;
      const message = JSON.parse(event.data ?? "null");

      if (message.type === "state") {
        accepted = true;
        attempts = 0;
        tokenRefreshed = false;
        waitingForVoice = false;
        // Stamped with this machine's clock: extrapolating from the server's `sampledAt` against
        // `Date.now()` here made a skewed clock freeze the bar, or run it ahead of the song.
        const stamped: PlaybackState = { ...message, receivedAt: deps.now() };
        lastState = stamped;
        // Only the "not connected" notice is about the connection, and it is over now.
        events.connectionRestored();
        events.status({ phase: "ready", state: stamped });
        return;
      }

      if (message.type === "unsubscribed") {
        // The server stopped the feed, because this user left the voice channel. It resumes by
        // itself — with a state frame — when they rejoin.
        const reason = errorText(message.reason);
        events.status(lastState ? { phase: "stale", state: lastState, reason } : { phase: "connecting", reason });
        return;
      }

      if (message.type === "profile") {
        events.profile({ stats: message.stats, level: message.level, badges: message.badges, plan: message.plan });
        return;
      }

      if (message.type === "guildContext") {
        events.clearNotice();
        events.guildContext({
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
        events.prefs(prefsFromFrame(message));
        return;
      }

      if (message.type === "capabilities") {
        events.capabilities({ canControl: message.canControl !== false });
        return;
      }

      if (message.type === "voteSkip") {
        events.notice(voteSkipNotice(message));
        return;
      }

      if (message.type === "voteBoost") {
        events.notice(voteBoostNotice(message));
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
          connectWithRetry();
          return;
        }
        if (
          message.error === "not_in_voice_channel" ||
          message.error === "rate_limited" ||
          message.error === "discord_unavailable"
        ) {
          // Worth waiting out. The server closes the socket, and the close handler retries.
          waitingForVoice = message.error === "not_in_voice_channel";
          const reason = errorText(message.error);
          events.status(lastState ? { phase: "stale", state: lastState, reason } : { phase: "connecting", reason });
          return;
        }
        return fail(errorText(message.error));
      }

      // After state, a rejection is transient — a refused control or setting — and must not
      // tear down a working view, so it becomes a notice.
      events.notice(errorText(message.error));
      // A rejected control (e.g. a non-DJ's seek/volume drag getting a "not_dj" back)
      // never triggers its own state broadcast, so nothing else would ever tell a held
      // slider to let go of the locally-dragged value it optimistically showed.
      events.rejected();
    });

    socket.addEventListener("close", () => {
      if (replacing || fatal || disposed) return;
      // "Waiting for the viewer to join voice" was the server's answer on an earlier socket. If this one
      // never heard from it (the bot is down), that answer is stale: back off like any other outage,
      // with the attempt cap, instead of retrying every few seconds for ever under the same message.
      if (!heardFromServer) waitingForVoice = false;
      // **Say so.** Otherwise the player stays on screen looking live — the progress bar running
      // on, every button silently doing nothing — until the reconnect happens to succeed.
      if (lastState && !waitingForVoice) {
        events.status({ phase: "stale", state: lastState, reason: RECONNECTING_TEXT });
      }
      scheduleReconnect(accessToken);
    });
  }

  return {
    start: connectWithRetry,
    /** The socket most recently opened, for the hook's sends. */
    socket: () => currentSocket,
    dispose() {
      disposed = true;
      deps.clearTimeout(reconnectTimer);
      stopWatchingVisibility?.();
      currentSocket?.close();
    },
  };
}
