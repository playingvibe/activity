import { describe, expect, it } from "vitest";
import {
  createSyncConnection,
  prefsFromFrame,
  voteBoostNotice,
  voteSkipNotice,
  type SyncDeps,
  type SyncEvents,
  type SyncSocket,
} from "./syncConnection";
import {
  LOST_CONNECTION_TEXT,
  MAX_RECONNECT_ATTEMPTS,
  NOT_CONNECTED_NOTICE,
  NOT_IN_SERVER_TEXT,
  RECONNECTING_TEXT,
  errorText,
  reconnectDelay,
  waitingRetryDelay,
} from "./syncSupport";
import type { SyncStatus } from "./syncTypes";

/**
 * The reconnect state machine, driven on a fake clock with a fake socket and a fake Discord. With `random` fixed at
 * 0.5 the jitter is exactly 1, so a delay is the plain backoff and a test can say "after 2 s" and mean it.
 */

class FakeSocket implements SyncSocket {
  readyState = 0;
  sent: Array<Record<string, unknown>> = [];
  closed = false;
  private listeners: Record<string, Array<(event: { data?: string }) => void>> = {};

  addEventListener(type: "open" | "message" | "close", listener: (event: { data?: string }) => void) {
    (this.listeners[type] ??= []).push(listener);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
    this.readyState = 3;
    this.emit("close");
  }
  emit(type: "open" | "message" | "close", data?: unknown) {
    if (type === "open") this.readyState = 1;
    for (const listener of this.listeners[type] ?? []) listener({ data: data === undefined ? undefined : JSON.stringify(data) });
  }
  /** A frame from the server. */
  receive(frame: Record<string, unknown>) {
    this.emit("message", frame);
  }
  /** The server hanging up, as opposed to `close()` which is us. */
  drop() {
    this.readyState = 3;
    this.emit("close");
  }
}

type Harness = ReturnType<typeof harness>;

function harness(options: { tokenResponses?: Array<() => Response | Promise<Response>>; hidden?: boolean; guildId?: string | null } = {}) {
  let now = 1_000_000;
  let nextId = 1;
  const timers: Array<{ id: number; at: number; fn: () => void }> = [];
  const sockets: FakeSocket[] = [];
  const statuses: SyncStatus[] = [];
  const log: { identity: unknown[]; profile: unknown[]; prefs: unknown[]; guildContext: unknown[]; capabilities: unknown[]; notices: string[]; cleared: number; restored: number; rejected: number } = {
    identity: [],
    profile: [],
    prefs: [],
    guildContext: [],
    capabilities: [],
    notices: [],
    cleared: 0,
    restored: 0,
    rejected: 0,
  };
  const state = { hidden: options.hidden ?? false, visibilityListeners: new Set<() => void>(), authorizeCalls: 0, authenticateCalls: [] as string[], fetchCalls: 0 };
  const tokenResponses = [...(options.tokenResponses ?? [])];

  const deps: SyncDeps = {
    sdk: {
      ready: async () => undefined,
      guildId: options.guildId === undefined ? "g1" : options.guildId,
      authorize: async () => {
        state.authorizeCalls += 1;
        return { code: `code-${state.authorizeCalls}` };
      },
      authenticate: async (token) => {
        state.authenticateCalls.push(token);
        return { user: { id: "u1", username: "mara", global_name: "Mara", avatar: "abc" } };
      },
    },
    fetch: (async () => {
      state.fetchCalls += 1;
      const next = tokenResponses.shift();
      if (next) return next();
      return Response.json({ access_token: `token-${state.fetchCalls}` });
    }) as typeof fetch,
    tokenEndpoint: "/token",
    openSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.push({ id, at: now + ms, fn });
      return id;
    },
    clearTimeout: (handle) => {
      const i = timers.findIndex((t) => t.id === handle);
      if (i >= 0) timers.splice(i, 1);
    },
    random: () => 0.5,
    now: () => now,
    visibility: {
      hidden: () => state.hidden,
      listen: (fn) => {
        state.visibilityListeners.add(fn);
        return () => state.visibilityListeners.delete(fn);
      },
    },
  };

  const events: SyncEvents = {
    status: (s) => statuses.push(s),
    identity: (i) => log.identity.push(i),
    profile: (p) => log.profile.push(p),
    prefs: (p) => log.prefs.push(p),
    guildContext: (c) => log.guildContext.push(c),
    capabilities: (c) => log.capabilities.push(c),
    notice: (n) => log.notices.push(n),
    clearNotice: () => (log.cleared += 1),
    connectionRestored: () => (log.restored += 1),
    rejected: () => (log.rejected += 1),
  };

  const connection = createSyncConnection(deps, events);

  return {
    connection,
    sockets,
    statuses,
    log,
    state,
    get last() {
      return statuses[statuses.length - 1];
    },
    get socket() {
      return sockets[sockets.length - 1]!;
    },
    /** Lets every pending promise settle (real microtasks, not the fake clock). */
    settle: () => new Promise((resolve) => setTimeout(resolve, 0)),
    /** Moves the fake clock forward and runs what came due, then lets the async work it started settle. */
    async advance(ms: number) {
      now += ms;
      for (;;) {
        const due = timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        timers.splice(timers.indexOf(due), 1);
        due.fn();
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    pendingTimers: () => timers.length,
    /** Signs in and gets an accepted socket with one state frame. */
    async connected() {
      connection.start();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const socket = sockets[sockets.length - 1]!;
      socket.emit("open");
      socket.receive(STATE);
      return socket;
    },
    now: () => now,
  };
}

const STATE = { type: "state", guildId: "g1", connected: true, sampledAt: 5, positionMs: 1000 };

describe("signing in", () => {
  it("authorizes, exchanges the code, announces who is signed in, and says hello with the token", async () => {
    const h = harness();
    h.connection.start();
    await h.settle();

    expect(h.state.authorizeCalls).toBe(1);
    expect(h.state.authenticateCalls).toEqual(["token-1"]);
    expect(h.log.identity).toEqual([
      { id: "u1", username: "mara", globalName: "Mara", avatarUrl: "https://cdn.discordapp.com/avatars/u1/abc.png" },
    ]);

    h.socket.emit("open");
    expect(h.socket.sent).toEqual([{ type: "hello", accessToken: "token-1", guildId: "g1" }]);
  });

  it("stamps a state frame with this machine's clock, not the server's, and goes ready", async () => {
    const h = harness();
    await h.connected();

    expect(h.last).toEqual({ phase: "ready", state: { ...STATE, receivedAt: h.now() } });
    expect(h.log.restored).toBe(1);
  });

  it("a rejected sign-in is final, with the stage it failed in", async () => {
    const h = harness({ tokenResponses: [() => Response.json({ error: "invalid_token" }, { status: 400 })] });
    const quiet = console.error;
    console.error = () => {};
    try {
      h.connection.start();
      await h.settle();
    } finally {
      console.error = quiet;
    }

    expect(h.last).toEqual({ phase: "error", error: `Failed during token exchange: ${errorText("invalid_token")}` });
    expect(h.sockets).toHaveLength(0);
  });

  it("a server error or a rate limit on the exchange is waited out with the backoff, then tried again", async () => {
    const h = harness({
      tokenResponses: [() => new Response("", { status: 503 }), () => new Response("", { status: 429 })],
    });
    h.connection.start();
    await h.settle();
    expect(h.last).toEqual({ phase: "connecting", reason: errorText("discord_unavailable") });
    expect(h.state.fetchCalls).toBe(1);

    await h.advance(reconnectDelay(0, () => 0.5) - 1);
    expect(h.state.fetchCalls).toBe(1);
    await h.advance(1);
    expect(h.state.fetchCalls).toBe(2);

    // The second wait is twice as long.
    await h.advance(reconnectDelay(1, () => 0.5));
    expect(h.state.fetchCalls).toBe(3);
    expect(h.sockets).toHaveLength(1);
  });

  it("a request that never gets an answer is treated the same way", async () => {
    const h = harness({ tokenResponses: [() => Promise.reject(new TypeError("Failed to fetch"))] });
    h.connection.start();
    await h.settle();
    expect(h.last).toEqual({ phase: "connecting", reason: errorText("discord_unavailable") });
  });

  it("gives up after the attempt cap, naming the stage", async () => {
    const down = () => new Response("", { status: 502 });
    const h = harness({ tokenResponses: Array.from({ length: MAX_RECONNECT_ATTEMPTS + 2 }, () => down) });
    const quiet = console.error;
    console.error = () => {};
    try {
      h.connection.start();
      await h.settle();
      for (let i = 0; i < MAX_RECONNECT_ATTEMPTS; i += 1) await h.advance(60_000);
    } finally {
      console.error = quiet;
    }

    expect(h.last?.phase).toBe("error");
    expect(h.state.fetchCalls).toBe(MAX_RECONNECT_ATTEMPTS + 1);
  });
});

describe("launched outside a server", () => {
  it("says so at once and signs in to nothing, instead of a hello the server can only refuse", async () => {
    const h = harness({ guildId: null });
    h.connection.start();
    await h.settle();

    expect(h.last).toEqual({ phase: "error", error: NOT_IN_SERVER_TEXT });
    expect(h.state.authorizeCalls).toBe(0);
    expect(h.sockets).toHaveLength(0);
  });
});

describe("reconnecting", () => {
  it("shows the last state frozen under a reconnecting notice, and reopens after the backoff", async () => {
    const h = harness();
    const first = await h.connected();
    first.drop();

    expect(h.last).toEqual({ phase: "stale", state: { ...STATE, receivedAt: h.now() }, reason: RECONNECTING_TEXT });
    expect(h.sockets).toHaveLength(1);

    await h.advance(reconnectDelay(0, () => 0.5));
    expect(h.sockets).toHaveLength(2);
    // It reuses the token it has: a lost socket is not an expired sign-in.
    h.socket.emit("open");
    expect(h.socket.sent[0]).toMatchObject({ type: "hello", accessToken: "token-1" });
  });

  it("doubles the wait with each failure and starts again from the first state frame", async () => {
    const h = harness();
    const first = await h.connected();
    first.drop();
    await h.advance(reconnectDelay(0, () => 0.5)); // second socket
    h.socket.drop(); // never said anything
    await h.advance(reconnectDelay(1, () => 0.5) - 1);
    expect(h.sockets).toHaveLength(2);
    await h.advance(1);
    expect(h.sockets).toHaveLength(3);

    h.socket.emit("open");
    h.socket.receive(STATE);
    h.socket.drop();
    await h.advance(reconnectDelay(0, () => 0.5));
    expect(h.sockets).toHaveLength(4);
  });

  it("stops after the cap and says to reopen the Activity", async () => {
    const h = harness();
    const first = await h.connected();
    first.drop();
    for (let i = 0; i < MAX_RECONNECT_ATTEMPTS; i += 1) {
      await h.advance(60_000);
      h.socket.drop();
    }

    expect(h.last).toEqual({ phase: "error", error: LOST_CONNECTION_TEXT });
    const before = h.sockets.length;
    await h.advance(600_000);
    expect(h.sockets).toHaveLength(before);
  });

  it("a hidden Activity waits to be seen before reconnecting, and only then", async () => {
    const h = harness({ hidden: false });
    const first = await h.connected();
    h.state.hidden = true;
    first.drop();

    await h.advance(reconnectDelay(0, () => 0.5));
    expect(h.sockets).toHaveLength(1);
    expect(h.state.visibilityListeners.size).toBe(1);

    for (const listener of [...h.state.visibilityListeners]) listener(); // still hidden
    expect(h.sockets).toHaveLength(1);

    h.state.hidden = false;
    for (const listener of [...h.state.visibilityListeners]) listener();
    expect(h.sockets).toHaveLength(2);
    expect(h.state.visibilityListeners.size).toBe(0);
  });
});

describe("a hello the server refuses", () => {
  async function refused(h: Harness, error: string) {
    h.connection.start();
    await h.settle();
    h.socket.emit("open");
    h.socket.receive({ type: "error", error });
  }

  it("not being in the voice channel is waited out for ever, without backing off", async () => {
    const h = harness();
    await refused(h, "not_in_voice_channel");
    expect(h.last).toEqual({ phase: "connecting", reason: errorText("not_in_voice_channel") });

    for (let i = 0; i < MAX_RECONNECT_ATTEMPTS * 2; i += 1) {
      const sockets = h.sockets.length;
      h.socket.receive({ type: "error", error: "not_in_voice_channel" });
      h.socket.drop();
      await h.advance(waitingRetryDelay(() => 0.5));
      expect(h.sockets).toHaveLength(sockets + 1);
    }
    expect(h.last?.phase).toBe("connecting");
  });

  it("but a socket that closes without a word means the bot is down, and that waiting is over", async () => {
    const h = harness();
    await refused(h, "not_in_voice_channel");
    h.socket.drop();
    await h.advance(waitingRetryDelay(() => 0.5));

    // The next sockets hear nothing at all: the cap is reached after that many failures, the next one gives up.
    for (let i = 0; i < MAX_RECONNECT_ATTEMPTS; i += 1) {
      h.socket.drop();
      await h.advance(60_000);
    }
    h.socket.drop();
    expect(h.last).toEqual({ phase: "error", error: LOST_CONNECTION_TEXT });
  });

  it("rate limits and a Discord outage keep the player waiting rather than failing", async () => {
    for (const error of ["rate_limited", "discord_unavailable"]) {
      const h = harness();
      await refused(h, error);
      expect(h.last).toEqual({ phase: "connecting", reason: errorText(error) });
    }
  });

  it("an invalid token fetches one fresh sign-in, and a second refusal is final", async () => {
    const h = harness();
    await refused(h, "invalid_token");
    await h.settle();

    expect(h.sockets[0]!.closed).toBe(true);
    expect(h.state.authorizeCalls).toBe(2);
    expect(h.sockets).toHaveLength(2);
    h.socket.emit("open");
    expect(h.socket.sent[0]).toMatchObject({ accessToken: "token-2" });

    h.socket.receive({ type: "error", error: "invalid_token" });
    expect(h.last).toEqual({ phase: "error", error: errorText("invalid_token") });
    expect(h.socket.closed).toBe(true);
  });

  it("anything else is final", async () => {
    const h = harness();
    await refused(h, "blocked");
    expect(h.last).toEqual({ phase: "error", error: errorText("blocked") });
    await h.advance(600_000);
    expect(h.sockets).toHaveLength(1);
  });

  it("a refreshed token is allowed again once a state frame has arrived", async () => {
    const h = harness();
    await refused(h, "invalid_token");
    await h.settle();
    h.socket.emit("open");
    h.socket.receive(STATE);
    h.socket.drop();
    await h.advance(reconnectDelay(0, () => 0.5));
    h.socket.receive({ type: "error", error: "invalid_token" });
    await h.settle();

    expect(h.last?.phase).not.toBe("error");
    expect(h.state.authorizeCalls).toBe(3);
  });
});

describe("frames on a live socket", () => {
  it("unsubscribed freezes the player under the reason, and before any state it is just connecting", async () => {
    const h = harness();
    const socket = await h.connected();
    socket.receive({ type: "unsubscribed", reason: "not_in_voice_channel" });
    expect(h.last).toMatchObject({ phase: "stale", reason: errorText("not_in_voice_channel") });

    const fresh = harness();
    fresh.connection.start();
    await fresh.settle();
    fresh.socket.emit("open");
    fresh.socket.receive({ type: "unsubscribed", reason: "not_in_voice_channel" });
    expect(fresh.last).toEqual({ phase: "connecting", reason: errorText("not_in_voice_channel") });
  });

  it("an error after state is a notice and a rejection, never the end of the view", async () => {
    const h = harness();
    const socket = await h.connected();
    const before = h.statuses.length;
    socket.receive({ type: "error", error: "not_dj" });

    expect(h.log.notices).toEqual([errorText("not_dj")]);
    expect(h.log.rejected).toBe(1);
    expect(h.statuses).toHaveLength(before);
  });

  it("a code nobody listed reads as something generic, never as the code", async () => {
    const h = harness();
    const socket = await h.connected();
    socket.receive({ type: "error", error: "a_code_from_a_newer_server" });
    expect(h.log.notices[0]).not.toContain("a_code_from_a_newer_server");
  });

  it("the guild context clears the notice and tolerates an older server's missing list", async () => {
    const h = harness();
    const socket = await h.connected();
    socket.receive({ type: "guildContext", config: { djRoles: [] }, roles: [], channels: [] });

    expect(h.log.cleared).toBe(1);
    expect(h.log.guildContext).toEqual([{ config: { djRoles: [] }, overridden: [], roles: [], channels: [] }]);
  });

  it("capabilities allow control unless the server says exactly false", async () => {
    const h = harness();
    const socket = await h.connected();
    socket.receive({ type: "capabilities", canControl: false });
    socket.receive({ type: "capabilities" });
    expect(h.log.capabilities).toEqual([{ canControl: false }, { canControl: true }]);
  });

  it("passes a profile through and ignores frames it does not know", async () => {
    const h = harness();
    const socket = await h.connected();
    socket.receive({ type: "profile", stats: { totalListeningTime: 1 }, level: { level: 2 }, badges: [], plan: null });
    socket.receive({ type: "something_new" });
    expect(h.log.profile).toHaveLength(1);
  });
});

describe("pure frame readers", () => {
  it("prefs: a malformed accent or an unknown background becomes null, a good one passes", () => {
    expect(prefsFromFrame({ accent: "#A1b2C3", background: "waves" })).toEqual({ accent: "#A1b2C3", background: "waves" });
    expect(prefsFromFrame({ accent: "red", background: "not-a-style" })).toEqual({ accent: null, background: null });
    expect(prefsFromFrame({ accent: 123, background: undefined })).toEqual({ accent: null, background: null });
    expect(prefsFromFrame({ accent: "#12345", background: null }).accent).toBeNull();
  });

  it("vote notices read the three outcomes", () => {
    expect(voteSkipNotice({ skipped: true })).toBe("Vote passed. Skipping.");
    expect(voteSkipNotice({ alreadyVoted: true, votes: 1, required: 3 })).toBe("You already voted (1/3).");
    expect(voteSkipNotice({ votes: 2, required: 3 })).toBe("Vote to skip registered (2/3).");
    expect(voteBoostNotice({ moved: true, direct: true })).toBe("Moved up next.");
    expect(voteBoostNotice({ moved: true })).toBe("Vote passed. Playing next.");
    expect(voteBoostNotice({ alreadyVoted: true, votes: 1, required: 2 })).toBe("You already boosted it (1/2).");
    expect(voteBoostNotice({ votes: 1, required: 2 })).toBe("Boost registered (1/2).");
  });

  it("the wording the hook shows while there is nothing to send to is stable", () => {
    expect(NOT_CONNECTED_NOTICE).toBe("Not connected to Vibe right now.");
  });
});

describe("disposing", () => {
  it("closes the socket, cancels a pending reconnect and a visibility wait, and ignores everything after", async () => {
    const h = harness();
    const socket = await h.connected();
    socket.drop();
    expect(h.pendingTimers()).toBe(1);

    h.connection.dispose();
    expect(h.pendingTimers()).toBe(0);
    await h.advance(600_000);
    expect(h.sockets).toHaveLength(1);

    const statuses = h.statuses.length;
    socket.receive(STATE);
    socket.drop();
    expect(h.statuses.length).toBe(statuses + 1); // the frame is still read; nothing reconnects
    expect(h.sockets).toHaveLength(1);
  });

  it("a visibility wait is dropped", async () => {
    const h = harness();
    const first = await h.connected();
    h.state.hidden = true;
    first.drop();
    await h.advance(reconnectDelay(0, () => 0.5));
    expect(h.state.visibilityListeners.size).toBe(1);

    h.connection.dispose();
    expect(h.state.visibilityListeners.size).toBe(0);
  });

  it("a sign-in that fails after dispose says nothing and opens nothing (the first run of StrictMode's double mount)", async () => {
    let release: (() => void) | undefined;
    const h = harness({
      tokenResponses: [
        () =>
          new Promise<Response>((resolve) => {
            release = () => resolve(new Response("", { status: 400 }));
          }),
      ],
    });
    h.connection.start();
    await h.settle();
    h.connection.dispose();
    release?.();
    await h.settle();

    expect(h.statuses).toHaveLength(0);
    expect(h.sockets).toHaveLength(0);
  });

  it("a sign-in that succeeds after dispose opens no socket", async () => {
    let release: (() => void) | undefined;
    const h = harness({
      tokenResponses: [
        () =>
          new Promise<Response>((resolve) => {
            release = () => resolve(Response.json({ access_token: "late" }));
          }),
      ],
    });
    h.connection.start();
    await h.settle();
    h.connection.dispose();
    release?.();
    await h.settle();

    expect(h.sockets).toHaveLength(0);
    expect(h.state.authenticateCalls).toEqual([]);
  });
});
