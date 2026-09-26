import { useEffect, useState, type CSSProperties } from "react";
import { useLivePosition, type PlaybackState } from "./useActivitySync";
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
    // to the instance's palette without needing to blur the art itself. Cut hard from an
    // earlier ~50%-alpha version (reported live as too strong, same "accent as a wash rather
    // than a presence" note the background glow already got) — tighter reach (28px vs. 44px
    // blur, -10px vs. -14px spread) and roughly a fifth the opacity.
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

export function NowPlaying({ state }: { state: PlaybackState }) {
  const track = state.track!;

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

/**
 * A range input whose thumb is held locally while dragged.
 *
 * Both sliders need identical behaviour and for the same reason: a range input fires onChange
 * on every pixel of movement, so committing on change would emit dozens of commands per drag
 * and trip the server's rate limiter. The seek slider additionally has to ignore its own
 * `value` prop mid-drag, or each incoming broadcast would yank the thumb back under the
 * finger. `resetKey` releases the local value once the server confirms with a fresh sample.
 */
function HeldRange({
  value,
  max,
  onCommit,
  ariaLabel,
  resetKey,
  style,
}: {
  value: number;
  max: number;
  onCommit: (value: number) => void;
  ariaLabel: string;
  resetKey?: number;
  style?: CSSProperties;
}) {
  const [held, setHeld] = useState<number | null>(null);

  // Drop a held value when the key changes. Adjusted during render rather than in an effect, as React
  // recommends for state derived from a prop: an effect would render once with the stale value first.
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setHeld(null);
  }

  const shown = held ?? value;
  const commit = () => {
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
      onChange={(e) => setHeld(Number(e.target.value))}
      onPointerUp={commit}
      onKeyUp={commit}
      aria-label={ariaLabel}
    />
  );
}

/**
 * Matches the floor the server keeps between actions that post to the channel
 * (`ActivityServer`'s `ANNOUNCED_COOLDOWN_MS`).
 *
 * The server is the real gate — a client can send whatever it likes. This exists so the second
 * press of a button shows as a button that is busy, rather than coming back as "Slow down a
 * moment." over a control the user had every reason to think they could press.
 */
const CONTROL_COOLDOWN_MS = 2_000;

function useControlCooldown(ms = CONTROL_COOLDOWN_MS) {
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
  art,
  live = true,
  canControl: canControlHint,
  noticeAt,
  onSeek,
  onTogglePlay,
  onPrevious,
  onSkip,
  onVolume,
  onShuffle,
  onLoop,
}: {
  state: PlaybackState;
  art: string | null;
  /** False while the connection is down: position frozen, every control disabled. */
  live?: boolean;
  canControl: boolean;
  noticeAt: number;
  onSeek: (ms: number) => void;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onVolume: (v: number) => void;
  onShuffle: () => void;
  onLoop: () => void;
}) {
  const position = useLivePosition(state, live);
  const track = state.track!;
  const length = track.lengthMs ?? 0;
  const paused = Boolean(state.paused);
  const repeatMode = state.repeatMode ?? "off";
  const canControl = live && canControlHint;
  const { cooling, guard } = useControlCooldown();
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
      {/* Progress as a hairline pinned to the top edge of the bar. Narrow frames have no room
          for a labelled scrubber, but losing progress entirely would be worse. */}
      {!track.isStream && (
        <div style={S.transportHairline} aria-hidden="true">
          <div
            style={{
              ...S.transportHairlineFill,
              width: `${length > 0 ? Math.min((position / length) * 100, 100) : 0}%`,
            }}
          />
        </div>
      )}

      <div className="vibe-transport-meta">
        <TransportArt src={art} />
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
            className="vibe-icon-btn"
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
            />
            <span style={S.transportTime}>{formatDuration(length)}</span>
          </div>
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
        />
      </div>
    </footer>
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
