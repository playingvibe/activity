import { useState } from "react";
import { useActivitySync, type ActivitySync } from "./useActivitySync";
import { useRichPresence } from "./useRichPresence";
import { useCanManageGuild } from "./useGuildPermissions";
import { resolveClientId } from "./discord";
import { thumbnailSrc } from "./media";
import { DEV_CLIENT_ID, resolveTheme, themeFromAccent, type Theme } from "./theme";
import Profile from "./Profile";
import Settings from "./Settings";
import { Shell, CenterMessage, ConnectingState, Notice } from "./Shell";
import { ThemePicker, TopBar } from "./TopBar";
import { Transport, Artwork, NowPlaying } from "./Transport";
import { Queue } from "./QueueRail";
import { S } from "./playerStyles";
import "./player.css";

export type View = "player" | "profile" | "settings";

/**
 * The Activity's main view: a shared, live control surface over the audio the bot is
 * already playing in the voice channel.
 *
 * Nothing here plays audio. Every participant sees the same state because it is pushed
 * from the bot, and every control is a request the bot authorizes before acting on.
 */
export default function Player({ sync: override }: { sync?: ActivitySync } = {}) {
  // The hook still runs in mock mode — hooks can't be conditional — but `enabled: false`
  // stops it attempting a Discord handshake that can only fail outside a real session.
  const realSync = useActivitySync(!override);
  const sync = override ?? realSync;
  const { status, notice, noticeAt, send, boost, capabilities } = sync;
  // `?view=settings` / `?view=profile` open straight into that screen, and are honoured **only
  // alongside `?mock=1`** — `override` is null in a real session, so a crafted URL cannot use
  // this to skip anything. It exists so `scripts/assets/capture-activity-shots.js` can photograph the
  // views that are otherwise only reachable by clicking, which is not something a headless
  // screenshot can do.
  const [view, setView] = useState<View>(() => {
    if (!override) return "player";
    const wanted = new URLSearchParams(window.location.search).get("view");
    return wanted === "settings" || wanted === "profile" ? wanted : "player";
  });
  const [queueOpen, setQueueOpen] = useQueueOpen();

  // clientId comes straight off the hostname/env, not the handshake, so this needs no
  // loading state of its own. Each bot instance runs this exact same deployed frontend — the
  // palette is what makes them visually distinct, not separate builds. Unresolvable (the
  // ?mock=1 preview) falls through to resolveTheme's own default palette.
  const resolved = resolveTheme(resolveClientId() ?? "");

  // TEMPORARY dev affordance — see ThemePicker.
  //
  // Three ways in, because Discord builds the Activity's iframe URL itself and there is no
  // way to append `?dev=1` to a real session:
  //   1. `?dev=1`          — the local `npm run dev` preview.
  //   2. the Vibe Dev app  — launching the Activity from that instance always shows it.
  //   3. a localStorage flag — for checking palettes from any other instance, set once from
  //      the Activity's own console: localStorage.setItem("vibe.dev", "1")
  // None of these can switch on for a normal user of a production instance.
  const devMode =
    new URLSearchParams(window.location.search).has("dev") ||
    resolveClientId() === DEV_CLIENT_ID ||
    readDevFlag();
  const [themeOverride, setThemeOverride] = useState<Theme | null>(null);
  // Precedence, narrowest first: the dev picker beats the user's own choice, which beats the
  // instance palette. The dev picker is a debugging affordance and has to win, or checking a
  // palette would silently show whoever is testing their own colour instead.
  const theme = themeOverride ?? (sync.prefs?.accent ? themeFromAccent(sync.prefs.accent) : resolved);

  // A client-side hint only — see useGuildPermissions.ts. Whether the settings button even
  // renders has no bearing on real access; the server re-checks on every request regardless.
  // Must wait for the same "authenticate() done" milestone useActivitySync reaches before it
  // opens the socket — getChannelPermissions() rejects with RPC 4006 any earlier.
  // In mock mode the SDK isn't there to ask, so assume yes — the settings panel is one of the
  // surfaces worth previewing. The real gate is server-side regardless.
  // `stale` counts: it is only ever reached after state arrived, so authenticate() had finished.
  const authenticated = status.phase === "ready" || status.phase === "stale";
  const canManageGuild = useCanManageGuild(authenticated && !override) || Boolean(override);

  // Hooks cannot run conditionally, so this sits above the early returns and stays inert
  // until the RPC channel is actually authenticated — and permanently so under ?mock=1,
  // where the mock reports "ready" but there is no RPC channel behind it.
  const rpcReady = status.phase === "ready" && !override;
  useRichPresence(rpcReady ? status.state : null, rpcReady);

  if (status.phase === "connecting") {
    return (
      <Shell theme={theme} backdrop={sync.prefs?.background ?? null}>
        <div className="vibe-body vibe-body--solo">
          <ConnectingState accent={theme.accent} reason={status.reason} />
        </div>
      </Shell>
    );
  }

  if (status.phase === "error") {
    return (
      <Shell theme={theme} backdrop={sync.prefs?.background ?? null}>
        <div className="vibe-body vibe-body--solo"><CenterMessage error>{status.error}</CenterMessage></div>
      </Shell>
    );
  }

  if (view === "profile") {
    return (
      <Shell theme={theme} backdrop={sync.prefs?.background ?? null}>
        <div className="vibe-body vibe-body--solo vibe-body--panel">
          <Profile sync={sync} onBack={() => setView("player")} />
        </div>
      </Shell>
    );
  }

  if (view === "settings") {
    return (
      <Shell theme={theme} backdrop={sync.prefs?.background ?? null}>
        <div className="vibe-body vibe-body--solo vibe-body--panel">
          <Settings sync={sync} onBack={() => setView("player")} />
        </div>
      </Shell>
    );
  }

  const { state } = status;
  // Stale: the last state received, shown frozen with its controls disabled under the reason.
  const live = status.phase === "ready";
  const banner = status.phase === "stale" ? status.reason : notice;

  if (!state.connected || !state.track) {
    return (
      <Shell theme={theme} backdrop={sync.prefs?.background ?? null}>
        <TopBar canManageGuild={canManageGuild} onOpen={setView} />
        <div className="vibe-body vibe-body--solo">
          <CenterMessage>
            Nothing is playing right now.
            <span style={S.hintLine}>
              Start something with <code style={S.code}>/play</code> in chat.
            </span>
          </CenterMessage>
          {banner && <Notice>{banner}</Notice>}
        </div>
      </Shell>
    );
  }

  const art = thumbnailSrc(state.track.thumbnail);

  return (
    <Shell theme={theme} backdrop={sync.prefs?.background ?? null} floored>
      {devMode && <ThemePicker current={theme} onPick={setThemeOverride} />}
      <TopBar
        canManageGuild={canManageGuild}
        onOpen={setView}
        queueOpen={queueOpen}
        onToggleQueue={() => setQueueOpen(!queueOpen)}
        queueCount={state.queueLength ?? state.queue?.length ?? 0}
      />

      <div className={`vibe-body${queueOpen ? "" : " vibe-body--solo"}`}>
        <div style={S.stage}>
          <Artwork key={art ?? "none"} src={art} accent={theme.accent} />
          <NowPlaying state={state} />
          {banner && <Notice>{banner}</Notice>}
        </div>

        {queueOpen && (
          <Queue
            tracks={state.queue ?? []}
            total={state.queueLength}
            disabled={!live}
            boostRequired={state.boostRequired}
            onJump={(position) => send("jump", position)}
            onBoost={boost}
          />
        )}
      </div>

      <Transport
        state={state}
        art={art}
        live={live}
        canControl={capabilities.canControl}
        noticeAt={noticeAt}
        onSeek={(ms) => send("seek", ms)}
        onTogglePlay={() => send(state.paused ? "resume" : "pause")}
        onPrevious={() => send("previous")}
        onSkip={() => send("skip")}
        onVolume={(v) => send("volume", v)}
        onShuffle={() => send("shuffle")}
        onLoop={() => send("loop")}
      />
    </Shell>
  );
}

const QUEUE_OPEN_KEY = "vibe.queueOpen";

/**
 * Whether the queue rail is showing, remembered per viewer.
 *
 * Storage access is wrapped because it genuinely throws in some hosts (a webview with site
 * data blocked, a private window), and a preference this small must never be able to take the
 * player down. Defaults to open: seeing what is queued is the reason the rail exists.
 */
function useQueueOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => {
    try {
      return window.localStorage.getItem(QUEUE_OPEN_KEY) !== "0";
    } catch {
      return true;
    }
  });

  const set = (next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(QUEUE_OPEN_KEY, next ? "1" : "0");
    } catch {
      // Preference simply doesn't persist; the session still works.
    }
  };

  return [open, set];
}

/**
 * TEMPORARY, paired with ThemePicker. Wrapped because storage genuinely throws in a webview
 * with site data blocked, and a dev affordance must never be able to take the player down.
 */
function readDevFlag(): boolean {
  try {
    return window.localStorage.getItem("vibe.dev") === "1";
  } catch {
    return false;
  }
}

/**
 * TEMPORARY: floating palette switcher, shown only with `?dev=1`.
 *
 * Exists because a given instance's colours can otherwise only be seen by deploying under
 * that instance's client ID — the palette is keyed off the hostname, so there is no way to
 * compare Vibe 2's blue against Vibe 3's yellow in one sitting. Overrides the resolved theme
 * in memory only; nothing is persisted and nothing reaches the server.
 *
 * Delete this component, its `ALL_THEMES` export, and the `devMode` branch in Player once the
 * palettes are signed off.
 */
