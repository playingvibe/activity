import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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

type Layer = { id: number; src: string | null };

/**
 * The picture that is showing and, while it changes, the one before it underneath.
 *
 * A song change used to swap the image in place, which flashed the empty frame between the two. The
 * old picture now stays until the new one has arrived over it, so one song leads into the next.
 */
function useLayers(src: string | null): [Layer[], () => void] {
  const [layers, setLayers] = useState<Layer[]>([{ id: 0, src }]);
  const top = layers[layers.length - 1]!;
  // Adjusted during render, as React recommends for state derived from a prop.
  if (top.src !== src) setLayers([top, { id: top.id + 1, src }]);
  return [layers, () => setLayers((current) => current.slice(-1))];
}

/**
 * One picture in a stack. The first is simply there; a later one waits until it has loaded (or
 * failed, or has nothing to load) and then arrives over the one below, and says when it is done.
 */
function PictureLayer({
  src,
  arriving,
  onArrived,
  empty,
}: {
  src: string | null;
  arriving: boolean;
  onArrived: () => void;
  /** What to draw when there is no picture, or it failed. */
  empty?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const missing = !src || failed;
  const ready = missing || loaded;

  return (
    <div
      className="vibe-layer"
      data-arriving={arriving ? (ready ? "now" : "wait") : undefined}
      onAnimationEnd={arriving ? onArrived : undefined}
    >
      {missing ? empty : <img src={src} alt="" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
    </div>
  );
}

/** The cover: the one raised thing on the stage. */
export function Artwork({ src }: { src: string | null }) {
  const [layers, settle] = useLayers(src);

  return (
    <div className="vibe-cover">
      {layers.map((layer, i) => (
        <PictureLayer
          key={layer.id}
          src={layer.src}
          arriving={i > 0}
          onArrived={settle}
          empty={
            <div className="vibe-cover__empty">
              <MusicNoteIcon size={48} />
            </div>
          }
        />
      ))}
    </div>
  );
}

/**
 * The cover's light on the stage: a blurred copy of it under a scrim. Decoration only, and the same
 * file the cover already loaded. The scrim, not the cover, decides the contrast of the text over it
 * (`tokens.test.ts` holds that for a pure white cover).
 */
export function Wash({ src }: { src: string | null }) {
  const [layers, settle] = useLayers(src);

  return (
    <div className="vibe-wash" aria-hidden="true">
      {layers.map((layer, i) => (
        <PictureLayer key={layer.id} src={layer.src} arriving={i > 0} onArrived={settle} />
      ))}
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
    <p className="vibe-sr" role="status">
      {trackAnnouncement(track)}
    </p>
  );
}

/** An empty line that still takes its height. */
const NBSP = " ";

/** The line under the artist: that it is a stream, and who asked for it. */
function creditLine(track: Track): string {
  if (track.isStream) return track.requesterName ? `Live stream, requested by ${track.requesterName}` : "Live stream";
  return track.requesterName ? `Requested by ${track.requesterName}` : "";
}

/**
 * The words beside the cover. Three lines that are always there, so a song with no artist or no
 * requester takes the same room as one with both and nothing around the block moves.
 */
export function NowPlaying({ track, viewerCanControl = true }: { track: Track; viewerCanControl?: boolean }) {
  return (
    <div className="vibe-now">
      <h1 className="vibe-now__title">{track.title ?? "Unknown track"}</h1>
      <p className="vibe-now__artist vibe-clip">{track.author || NBSP}</p>
      <p className="vibe-now__by vibe-clip">{creditLine(track) || NBSP}</p>
      {/* Why most of the controls are dimmed, in words: a tooltip is no use on a phone. It is the same for
          the whole session, so it moves nothing when the song changes. */}
      {!viewerCanControl && <p className="vibe-now__note">Only a DJ can control playback. Skip is a vote.</p>}
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
 *
 * The rail is drawn under the input, not by it: its fill is scaled, which costs no layout and can
 * glide between two samples, where a native track can only be repainted.
 */
function HeldRange({
  value,
  max,
  onCommit,
  ariaLabel,
  resetKey,
  quiet = false,
  glide = false,
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
  /** A secondary slider (the volume): its fill is ink, so the accent stays on the song's progress. */
  quiet?: boolean;
  /** The value is a clock: the fill moves smoothly from one sample to the next while nothing holds it. */
  glide?: boolean;
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
    <span
      className={`vibe-slider${quiet ? " vibe-slider--quiet" : ""}`}
      data-glide={glide && held === null ? "" : undefined}
    >
      <span className="vibe-meter">
        <span className="vibe-meter__fill" style={{ transform: `scaleX(${max > 0 ? shown / max : 0})` } as CSSProperties} />
      </span>
      <input
        type="range"
        className="vibe-range"
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
    </span>
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
 * The pinned strip that holds every control.
 *
 * Always visible, never part of the scrolling region. On a wide pane it is one row: the time, the
 * five buttons dead centre, then the volume and whatever `tools` the view hands it (the queue
 * toggle, settings, profile), with the seek bar as its top edge. On a narrow one the seek bar is a
 * row of its own between the two times, over the buttons.
 *
 * The thumbnail, title and progress line in here are only shown by the read-only small windows
 * (`styles/small-windows.css`), where they are all there is.
 */
export function Transport({
  state,
  track,
  art,
  live = true,
  canControl: canControlHint,
  noticeAt,
  cooldown,
  notice,
  tools,
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
  /** The notice, floated over the strip's top edge: beside the controls that caused it, and moving nothing. */
  notice?: ReactNode;
  /** Buttons for the right end of the strip, on a pane wide enough to hold them. */
  tools?: ReactNode;
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

  // Everything except skip is DJ-gated server-side. Showing the buttons as disabled is the
  // honest thing: offering a control that silently fails reads as a broken app, and the
  // server refuses these regardless of what the UI does. The dimming is the stylesheet's, from `disabled`.

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
      {notice}
      {!track.isStream && <Hairline state={state} track={track} live={live} />}

      <div className="vibe-transport-meta">
        <TransportArt key={art ?? "none"} src={art} />
        <div className="vibe-transport-text">
          <h1 className="vibe-transport-title vibe-clip">{track.title ?? "Unknown track"}</h1>
          {track.author && <span className="vibe-transport-artist vibe-clip">{track.author}</span>}
        </div>
      </div>

      {track.isStream ? (
        <div className="vibe-seek vibe-seek--live">
          <span className="vibe-seek__times vibe-time">Live stream</span>
        </div>
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

      <div className="vibe-controls">
        <button
          className="vibe-btn"
          onClick={guard(onShuffle)}
          disabled={!ready}
          title={djTitle}
          aria-label="Shuffle queue"
        >
          <ShuffleIcon size={20} />
        </button>
        <button
          className="vibe-btn vibe-btn--strong"
          onClick={guard(onPrevious)}
          disabled={!ready}
          title={djTitle}
          aria-label="Previous track"
        >
          <PreviousIcon size={24} />
        </button>
        <button
          className="vibe-play"
          onClick={guard(onTogglePlay)}
          disabled={!ready}
          title={djTitle}
          aria-label={paused ? "Play" : "Pause"}
        >
          {paused ? <PlayIcon size={24} /> : <PauseIcon size={24} />}
        </button>
        <button
          className="vibe-btn vibe-btn--strong"
          onClick={guard(onSkip)}
          disabled={!skipReady}
          title={skipReady ? undefined : live ? busyTitle : "Not connected to Vibe"}
          aria-label="Skip"
        >
          <SkipIcon size={24} />
        </button>
        <button
          className="vibe-btn vibe-loop"
          data-mode={repeatMode}
          onClick={guard(onLoop)}
          disabled={!ready}
          title={djTitle}
          aria-label={`Repeat: ${repeatMode === "off" ? "off" : repeatMode}`}
        >
          <LoopIcon size={20} mode={repeatMode === "off" ? undefined : repeatMode} />
        </button>
      </div>

      <div className="vibe-transport-side">
        <div className="vibe-transport-volume">
          <VolumeIcon size={20} />
          <HeldRange
            value={state.volume ?? 100}
            max={100}
            onCommit={onVolume}
            ariaLabel="Volume"
            quiet
            disabled={!canControl}
            title={djTitle}
          />
        </div>
        {tools && <div className="vibe-transport-tools">{tools}</div>}
      </div>
    </footer>
  );
}

/**
 * Progress as a line along the window's edge, for the read-only small windows, which have no seek bar.
 * Owns the live position, so its tick re-renders this and not the strip.
 */
function Hairline({ state, track, live }: { state: PlaybackState; track: Track; live: boolean }) {
  const position = useLivePosition(state, live);
  const length = track.lengthMs ?? 0;

  return (
    <div className="vibe-meter vibe-hairline" aria-hidden="true">
      <div className="vibe-meter__fill" style={{ transform: `scaleX(${length > 0 ? Math.min(position / length, 1) : 0})` }} />
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
    <div className="vibe-seek">
      <span className="vibe-seek__times vibe-time vibe-num">
        <span className="vibe-seek__now">{formatDuration(Math.min(position, length))}</span>
        <span className="vibe-seek__of" aria-hidden="true">/</span>
        <span className="vibe-seek__len">{formatDuration(length)}</span>
      </span>
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
        glide={live && !state.paused}
        disabled={!canControl}
        title={title}
        // A percent of the track, never less than a second: a millisecond per arrow key was a
        // re-buffer for the room per press, for no audible movement.
        step={Math.max(1_000, Math.round(length / 100))}
        valueText={(ms) => `${formatDuration(ms)} of ${formatDuration(length)}`}
      />
    </div>
  );
}

/** The small square thumbnail the read-only windows show, with the same failed-image fallback as the queue rows. */
function TransportArt({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="vibe-thumb">
        <MusicNoteIcon size={18} />
      </span>
    );
  }

  return <img src={src} alt="" className="vibe-thumb" onError={() => setFailed(true)} />;
}
