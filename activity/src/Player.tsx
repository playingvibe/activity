import { useEffect, useRef, useState, type ReactNode } from "react";
import { useActivitySync, type ActivitySync } from "./useActivitySync";
import type { PlaybackState, Track } from "./syncTypes";
import { useRichPresence } from "./useRichPresence";
import { useCanManageGuild } from "./useGuildPermissions";
import { resolveClientId } from "./discord";
import { thumbnailSrc } from "./media";
import { resolveTheme, themeFromAccent } from "./theme";
import Profile from "./Profile";
import Settings from "./Settings";
import { Shell, CenterMessage, ConnectingState, Notice } from "./Shell";
import { TopBar } from "./TopBar";
import { Transport, Artwork, NowPlaying, useControlCooldown } from "./Transport";
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
  const { status, notice } = sync;
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
  // The top-bar button that opened the current panel, so Back can put keyboard focus there: opening a panel
  // replaces the whole screen, which leaves focus on the page.
  const openedFrom = useRef<View | null>(null);
  const [queueOpen, setQueueOpen] = useQueueOpen();
  const wide = useWideFrame();
  // One cooldown for the transport and the queue rows alike: the server cools down every action that
  // posts to the channel together, and a row click right after Pause was refused with "Slow down".
  const cooldown = useControlCooldown();
  // The toggle only exists on a wide frame, so "hidden" only means something there: below the breakpoint
  // the queue stacks under the player, and a stored "hidden" would otherwise leave no way to reopen it.
  const showQueue = queueOpen || !wide;

  useEffect(() => {
    if (view !== "player" || !openedFrom.current) return;
    document.getElementById(`vibe-open-${openedFrom.current}`)?.focus();
    openedFrom.current = null;
  }, [view]);

  /** A panel is opened from the top bar; remember which button, for the way back. */
  const openPanel = (next: View) => {
    openedFrom.current = next;
    setView(next);
  };

  // clientId comes straight off the hostname/env, not the handshake, so this needs no
  // loading state of its own. Each bot instance runs this exact same deployed frontend — the
  // palette is what makes them visually distinct, not separate builds. Unresolvable (the
  // ?mock=1 preview) falls through to resolveTheme's own default palette.
  const resolved = resolveTheme(resolveClientId() ?? "");

  // Precedence, narrowest first: the user's own choice beats the instance palette.
  const theme = sync.prefs?.accent ? themeFromAccent(sync.prefs.accent) : resolved;

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

  // One shell for every screen: only what goes inside it differs.
  const shell = (children: ReactNode, floored = false) => (
    <Shell theme={theme} backdrop={sync.prefs?.background ?? null} floored={floored}>
      {children}
    </Shell>
  );

  if (status.phase === "connecting") {
    return shell(
      <div className="vibe-body vibe-body--solo">
        <ConnectingState accent={theme.accent} reason={status.reason} />
      </div>
    );
  }

  if (status.phase === "error") {
    return shell(
      <div className="vibe-body vibe-body--solo"><CenterMessage error>{status.error}</CenterMessage></div>
    );
  }

  if (view === "profile") {
    return shell(
      <div className="vibe-body vibe-body--solo vibe-body--panel">
        <Profile sync={sync} onBack={() => setView("player")} />
      </div>
    );
  }

  if (view === "settings") {
    return shell(
      <div className="vibe-body vibe-body--solo vibe-body--panel">
        <Settings sync={sync} onBack={() => setView("player")} />
      </div>
    );
  }

  const { state } = status;
  // Stale: the last state received, shown frozen with its controls disabled under the reason.
  const live = status.phase === "ready";
  const banner = status.phase === "stale" ? status.reason : notice;

  if (!state.connected || !state.track) {
    return shell(
      <>
        <TopBar canManageGuild={canManageGuild} onOpen={openPanel} />
        <div className="vibe-body vibe-body--solo">
          <CenterMessage>
            Nothing is playing right now.
            <span style={S.hintLine}>
              Start something with <code style={S.code}>/play</code> in chat.
            </span>
          </CenterMessage>
          <Notice>{banner}</Notice>
        </div>
      </>
    );
  }

  return shell(
    <PlayingView
      sync={sync}
      state={state}
      track={state.track}
      live={live}
      banner={banner}
      accent={theme.accent}
      canManageGuild={canManageGuild}
      onOpen={openPanel}
      queueOpen={queueOpen}
      showQueue={showQueue}
      onToggleQueue={() => setQueueOpen(!queueOpen)}
      cooldown={cooldown}
    />,
    true
  );
}

type PlayingViewProps = {
  sync: ActivitySync;
  state: PlaybackState;
  track: Track;
  live: boolean;
  banner: string | null | undefined;
  accent: string;
  canManageGuild: boolean;
  onOpen: (view: View) => void;
  queueOpen: boolean;
  showQueue: boolean;
  onToggleQueue: () => void;
  cooldown: ReturnType<typeof useControlCooldown>;
};

/** The screen with something playing: the top bar, the stage and queue rail, and the transport pinned under them. */
function PlayingView({
  sync,
  state,
  track,
  live,
  banner,
  accent,
  canManageGuild,
  onOpen,
  queueOpen,
  showQueue,
  onToggleQueue,
  cooldown,
}: PlayingViewProps) {
  const { send, boost, jump, noticeAt, capabilities } = sync;
  const art = thumbnailSrc(track.thumbnail);

  return (
    <>
      <TopBar
        canManageGuild={canManageGuild}
        onOpen={onOpen}
        queueOpen={queueOpen}
        onToggleQueue={onToggleQueue}
        queueCount={state.queueLength ?? state.queue?.length ?? 0}
      />

      <div className={`vibe-body${showQueue ? "" : " vibe-body--solo"}`}>
        <div style={S.stage}>
          <Artwork key={art ?? "none"} src={art} accent={accent} />
          <NowPlaying state={state} track={track} />
          <Notice>{banner}</Notice>
        </div>

        {showQueue && (
          <Queue
            tracks={state.queue ?? []}
            total={state.queueLength}
            disabled={!live}
            boostRequired={state.boostRequired}
            onJump={jump}
            onBoost={boost}
            cooldown={cooldown}
          />
        )}
      </div>

      <Transport
        state={state}
        track={track}
        art={art}
        live={live}
        canControl={capabilities.canControl}
        noticeAt={noticeAt}
        cooldown={cooldown}
        onSeek={(ms) => send("seek", ms)}
        onTogglePlay={() => send(state.paused ? "resume" : "pause")}
        onPrevious={() => send("previous")}
        onSkip={() => send("skip")}
        onVolume={(v) => send("volume", v)}
        onShuffle={() => send("shuffle")}
        onLoop={() => send("loop")}
      />
    </>
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
/** Whether the frame is wide enough for the queue to be its own rail (`player.css`'s 900 px breakpoint). */
function useWideFrame(): boolean {
  const query = "(min-width: 900px)";
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setWide(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, []);

  return wide;
}

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
