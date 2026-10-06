import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLivePosition, type PlaybackState, type Track } from "./useActivitySync";
import {
  PlayIcon,
  PauseIcon,
  SkipIcon,
  PreviousIcon,
  VolumeIcon,
  MusicNoteIcon,
  ShuffleIcon,
  LoopIcon,
} from "./icons";
import { formatDuration } from "./format";
import { S } from "./playerStyles";

export function Artwork({ src, accent }: { src: string | null; accent: string }) {
  const [failed, setFailed] = useState(false);
  const showPlaceholder = !src || failed;

  const frameStyle: CSSProperties = {
    ...S.artFrame,
    // A neutral shadow for depth plus a faint accent-tinted glow underneath — ties the card
    // to the instance's palette without needing to blur the art itself.
    boxShadow: `0 10px 24px rgba(0,0,0,0.55), 0 12px 28px -10px ${accent}29`,
  };

  return (
    <div style={frameStyle} className="vibe-fade-in">
      {showPlaceholder ? (
        <div style={S.artPlaceholder}>
          <MusicNoteIcon />
        </div>
      ) : (
        <img
          src={src}
          alt=""
          style={S.artImage}
          className="vibe-art-swap"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

/** What a screen reader is told when the song changes. */
export function trackAnnouncement(track: Track): string {
  return `Now playing: ${track.title ?? "Unknown track"}${track.author ? ` by ${track.author}` : ""}`;
}

/**
 * The song change, for a screen reader. The title on screen updates silently, so a listener who is not looking
 * never learns the song changed. Polite, out of sight, and **always in the page**: a live region is announced when
 * its text changes, and one inserted with its text already inside it often is not. Mounted with the playing view,
 * so it stays put as the track changes under it.
 */
export function TrackAnnouncement({ track }: { track: Track }) {
  return (
    <p style={S.noticeEmpty} role="status">
      {trackAnnouncement(track)}
    </p>
  );
}

export function NowPlaying({ state, track }: { state: PlaybackState; track: Track }) {
  return (
    <div style={S.meta} className="vibe-fade-in">
      <p style={S.eyebrow}>{state.paused ? "Paused" : "Now playing"}</p>
      <h1 style={S.title}>{track.title ?? "Unknown track"}</h1>
      {track.author && <p style={S.author}>{track.author}</p>}
      {track.isStream && <p style={S.hint}>Live stream</p>}
      {track.requesterName && <p style={S.requester}>Requested by {track.requesterName}</p>}
    </div>
  );
}

/** How long the keyboard must be still before a slider sends where it was set. */
const KEY_COMMIT_IDLE_MS = 400;

/**
 * A range input whose thumb is held locally while dragged.
 *
 * Both sliders need identical behaviour and for the same reason: a range input fires onChange
 * on every pixel of movement, so committing on change would emit dozens of commands per drag
 * and trip the server's rate limiter. The seek slider additionally has to ignore its own
 * `value` prop mid-drag, or each incoming broadcast would yank the thumb back under the
 * finger. `resetKey` releases the local value once the server confirms with a fresh sample.
 *
 * A pointer commits when released. The keyboard commits after a short idle instead: each arrow key is
 * a step, and a seek per press would re-buffer the track for everyone in the channel once for each.
 */
function HeldRange({
  value,
  max,
  onCommit,
  ariaLabel,
  resetKey,
  style,
  step,
  valueText,
  disabled = false,
  title,
}: {
  value: number;
  max: number;
  onCommit: (value: number) => void;
  ariaLabel: string;
  resetKey?: number;
  style?: CSSProperties;
  /** Greyed and inert, as the buttons are when the control is not allowed or there is no connection. */
  disabled?: boolean;
  title?: string;
  /** One arrow key's worth. The default of 1 suits a 0-100 volume; a position in milliseconds needs more. */
  step?: number;
  /** What a screen reader says for a value, where the number alone is not it (a position in ms). */
  valueText?: (value: number) => string;
}) {
  const [held, setHeld] = useState<number | null>(null);
  // From pointer down to release: a broadcast that arrives meanwhile must not take the thumb back from
  // the finger, or releasing would find nothing held and send no seek.
  const [dragging, setDragging] = useState(false);
  const viaKeyboard = useRef(false);
  // Read when the idle timer fires, so a parent re-rendering with a new callback does not restart it.
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    if (held === null || !viaKeyboard.current) return;
    const id = setTimeout(() => {
      viaKeyboard.current = false;
      onCommitRef.current(held);
      if (resetKey === undefined) setHeld(null);
    }, KEY_COMMIT_IDLE_MS);
    return () => clearTimeout(id);
  }, [held, resetKey]);

  // Drop a held value when the key changes. Adjusted during render rather than in an effect, as React
  // recommends for state derived from a prop: an effect would render once with the stale value first.
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    if (!dragging) setHeld(null);
  }

  const shown = held ?? value;
  const commit = () => {
    setDragging(false);
    if (held !== null) {
      onCommit(held);
      if (resetKey === undefined) setHeld(null);
    }
  };

  return (
    <input
      type="range"
      className="vibe-range"
      style={{ "--vibe-fill": `${max > 0 ? (shown / max) * 100 : 0}%`, ...style } as CSSProperties}
      min={0}
      max={Math.max(max, 1)}
      value={shown}
      step={step}
      onChange={(e) => setHeld(Number(e.target.value))}
      onPointerDown={(e) => {
        viaKeyboard.current = false;
        setDragging(true);
        // So the release is delivered here even when it happens outside the slider: without capture a mouse drag
        // let go elsewhere would never commit, and the thumb would stay where the finger left it.
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* a synthetic or already-released pointer: the release then arrives as it always did */
        }
      }}
      onPointerUp={commit}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={() => {
        viaKeyboard.current = true;
      }}
      aria-label={ariaLabel}
      aria-valuetext={valueText?.(shown)}
      disabled={disabled}
      title={title}
    />
  );
}

/**
 * Matches the floor the server keeps between actions that post to the channel
 * (`ANNOUNCED_COOLDOWN_MS` in `src/presentation/http/constants.js`).
 *
 * The server is the real gate — a client can send whatever it likes. This exists so the second
 * press of a button shows as a button that is busy, rather than coming back as "Slow down a
 * moment." over a control the user had every reason to think they could press.
 */
const CONTROL_COOLDOWN_MS = 2_000;

export function useControlCooldown(ms = CONTROL_COOLDOWN_MS) {
  const [until, setUntil] = useState(0);

  useEffect(() => {
    if (!until) return;
    const id = setTimeout(() => setUntil(0), Math.max(0, until - Date.now()));
    return () => clearTimeout(id);
  }, [until]);

  return {
    cooling: until > 0,
    /** Wraps a control so it starts the cooldown, and does nothing at all while one is running. */
    guard: (run: () => void) => () => {
      if (until > 0) return;
      setUntil(Date.now() + ms);
      run();
    },
  };
}

/**
 * The pinned transport bar.
 *
 * Always visible, never part of the scrolling region — this is the piece that makes the
 * surface read as an app rather than a page with controls somewhere in it. Three sections on
 * desktop (track / controls / volume) so the buttons stay optically centred however long the
 * title is; on narrow frames it collapses to track + controls with the scrubber as a hairline
 * across the top of the bar.
 */
export function Transport({
  state,
  track,
  art,
  live = true,
  canControl: canControlHint,
  noticeAt,
  cooldown,
  onSeek,
  onTogglePlay,
  onPrevious,
  onSkip,
  onVolume,
  onShuffle,
  onLoop,
}: {
  state: PlaybackState;
  /** The track that is playing: the caller has already checked there is one. */
  track: Track;
  art: string | null;
  /** False while the connection is down: position frozen, every control disabled. */
  live?: boolean;
  canControl: boolean;
  noticeAt: number;
  /** One cooldown for every control that posts to the channel, the queue rows' jump included (`useControlCooldown()`). */
  cooldown: ReturnType<typeof useControlCooldown>;
  onSeek: (ms: number) => void;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onVolume: (v: number) => void;
  onShuffle: () => void;
  onLoop: () => void;
}) {
  const paused = Boolean(state.paused);
  const repeatMode = state.repeatMode ?? "off";
  const canControl = live && canControlHint;
  const { cooling, guard } = cooldown;
  // Pressable right now: DJ rights, a live connection, and no cooldown running.
  const ready = canControl && !cooling;
  // Skip is the one control a non-DJ may press — it falls through to the same vote `/skip` runs.
  const skipReady = live && !cooling;

  const loopStyle: CSSProperties = {
    ...S.miniBtn,
    color: repeatMode === "off" ? "#f5f2f3" : "var(--vibe-accent)",
  };

  // Everything except skip is DJ-gated server-side. Showing the buttons as disabled is the
  // honest thing: offering a control that silently fails reads as a broken app, and the
  // server refuses these regardless of what the UI does.
  const gated = (extra?: CSSProperties): CSSProperties =>
    ready ? { ...extra } : { ...extra, opacity: 0.35, cursor: "not-allowed" };
  const offline = (extra?: CSSProperties): CSSProperties =>
    skipReady ? { ...extra } : { ...extra, opacity: 0.35, cursor: "not-allowed" };

  const busyTitle = "Just a moment…";
  const djTitle = !live
    ? "Not connected to Vibe"
    : cooling
      ? busyTitle
      : canControl
        ? undefined
        : "Only a DJ can control playback";

  return (
    <footer className="vibe-transport">
      {!track.isStream && <Hairline state={state} track={track} live={live} />}

      <div className="vibe-transport-meta">
        <TransportArt key={art ?? "none"} src={art} />
        <div style={S.transportText}>
          <span style={S.transportTitle}>{track.title ?? "Unknown track"}</span>
          {track.author && <span style={S.transportAuthor}>{track.author}</span>}
        </div>
      </div>

      <div className="vibe-transport-center">
        <div style={S.transportRow}>
          <button
            className="vibe-icon-btn"
            style={gated(S.miniBtn)}
            onClick={guard(onShuffle)}
            disabled={!ready}
            title={djTitle}
            aria-label="Shuffle queue"
          >
            <ShuffleIcon />
          </button>
          <button
            className="vibe-icon-btn vibe-skip-btn"
            style={gated(S.skipBtn)}
            onClick={guard(onPrevious)}
            disabled={!ready}
            title={djTitle}
            aria-label="Previous track"
          >
            <PreviousIcon />
          </button>
          <button
            className="vibe-icon-btn vibe-play-btn"
            style={gated(S.playBtn)}
            onClick={guard(onTogglePlay)}
            disabled={!ready}
            title={djTitle}
            aria-label={paused ? "Play" : "Pause"}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
          <button
            className="vibe-icon-btn vibe-skip-btn"
            style={offline(S.skipBtn)}
            onClick={guard(onSkip)}
            disabled={!skipReady}
            title={skipReady ? undefined : live ? busyTitle : "Not connected to Vibe"}
            aria-label="Skip"
          >
            <SkipIcon />
          </button>
          <button
            className="vibe-icon-btn vibe-loop-btn"
            data-mode={repeatMode}
            style={gated(loopStyle)}
            onClick={guard(onLoop)}
            disabled={!ready}
            title={djTitle}
            aria-label={`Repeat: ${repeatMode === "off" ? "off" : repeatMode}`}
          >
            <LoopIcon mode={repeatMode === "off" ? undefined : repeatMode} />
          </button>
        </div>

        {track.isStream ? (
          <span style={S.transportLive}>Live stream</span>
        ) : (
          <Scrubber
            state={state}
            track={track}
            live={live}
            canControl={canControl}
            noticeAt={noticeAt}
            title={djTitle}
            onSeek={onSeek}
          />
        )}
      </div>

      <div className="vibe-transport-volume">
        <VolumeIcon />
        <HeldRange
          value={state.volume ?? 100}
          max={100}
          onCommit={onVolume}
          ariaLabel="Volume"
          style={{ maxWidth: 120 }}
          disabled={!canControl}
          title={djTitle}
        />
      </div>
    </footer>
  );
}

/**
 * Progress as a hairline pinned to the top edge of the bar. Narrow frames have no room for a labelled scrubber, but
 * losing progress entirely would be worse. Owns the live position, so its tick re-renders this and not the bar.
 */
function Hairline({ state, track, live }: { state: PlaybackState; track: Track; live: boolean }) {
  const position = useLivePosition(state, live);
  const length = track.lengthMs ?? 0;

  return (
    <div style={S.transportHairline} className="vibe-hairline" aria-hidden="true">
      <div
        style={{
          ...S.transportHairlineFill,
          width: `${length > 0 ? Math.min((position / length) * 100, 100) : 0}%`,
        }}
      />
    </div>
  );
}

/** The two times and the seek slider. Owns the live position, so its 500 ms tick does not re-render the buttons. */
function Scrubber({
  state,
  track,
  live,
  canControl,
  noticeAt,
  title,
  onSeek,
}: {
  state: PlaybackState;
  track: Track;
  live: boolean;
  canControl: boolean;
  noticeAt: number;
  title: string | undefined;
  onSeek: (ms: number) => void;
}) {
  const position = useLivePosition(state, live);
  const length = track.lengthMs ?? 0;

  return (
    <div className="vibe-transport-scrub">
      <span style={S.transportTime}>{formatDuration(Math.min(position, length))}</span>
      <HeldRange
        value={Math.min(position, length)}
        max={length}
        onCommit={onSeek}
        // Combines two independent, monotonic sources into one key: a normal state
        // broadcast (sampledAt) and a rejected control (noticeAt) — see noticeAt's own
        // comment. Either one changing must let go of the dragged value; adding them is
        // enough since both only ever increase, so the sum only ever increases too.
        resetKey={state.sampledAt + noticeAt}
        ariaLabel="Seek"
        disabled={!canControl}
        title={title}
        // A percent of the track, never less than a second: a millisecond per arrow key was a
        // re-buffer for the room per press, for no audible movement.
        step={Math.max(1_000, Math.round(length / 100))}
        valueText={(ms) => `${formatDuration(ms)} of ${formatDuration(length)}`}
      />
      <span style={S.transportTime}>{formatDuration(length)}</span>
    </div>
  );
}

/** Small square thumbnail in the transport bar, with the same failed-image fallback as the
 * queue rows and the main artwork. */
function TransportArt({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div style={S.transportArtPlaceholder}>
        <MusicNoteIcon size={16} />
      </div>
    );
  }

  return <img src={src} alt="" style={S.transportArt} onError={() => setFailed(true)} />;
}
