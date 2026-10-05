import { useState } from "react";
import type { Track } from "./useActivitySync";
import { thumbnailSrc } from "./media";
import { BoostIcon, MusicNoteIcon } from "./icons";
import { formatDuration } from "./format";
import { S } from "./playerStyles";

/**
 * The upcoming tracks.
 *
 * `total` is the real queue length. The server sends at most the first 50 tracks, so the heading
 * counts `total`, not the array: otherwise a 300-track playlist would read "Up next · 50" with
 * nothing saying the list stopped early. `disabled` is set while the player is not live, so a row cannot be pressed into a
 * connection that is not there.
 */
export function Queue({
  tracks,
  total = tracks.length,
  disabled = false,
  boostRequired = 1,
  cooldown,
  onJump,
  onBoost,
}: {
  tracks: Track[];
  total?: number;
  disabled?: boolean;
  /** How many boosts make a track move to next. */
  boostRequired?: number;
  /** The cooldown shared with the transport; a jump is one of the actions the server cools down together. */
  cooldown?: { cooling: boolean; guard: (run: () => void) => () => void };
  /** 1-indexed position and the uri that was on screen. */
  onJump: (position: number, uri: string | null) => void;
  /** 1-indexed position and the uri that was on screen. */
  onBoost?: (position: number, uri: string | null) => void;
}) {
  if (total === 0) {
    return (
      <section className="vibe-queue-rail">
        <h2 style={S.heading}>Up next</h2>
        <p style={S.hint}>Nothing queued up next.</p>
      </section>
    );
  }

  const rowKeys = queueRowKeys(tracks);

  return (
    <section style={S.queueSection} className="vibe-queue-rail vibe-fade-in">
      <h2 style={S.heading}>Up next · {total}</h2>
      {total > tracks.length && (
        <p style={S.hint}>
          Showing the first {tracks.length} of {total}.
        </p>
      )}
      <ol style={S.queue}>
        {tracks.map((track, i) => (
          <QueueRow
            key={rowKeys[i]}
            track={track}
            // 1-indexed to match QueueService.jump()'s position argument.
            position={i + 1}
            disabled={disabled}
            boostRequired={boostRequired}
            cooldown={cooldown}
            onJump={onJump}
            onBoost={onBoost}
          />
        ))}
      </ol>
    </section>
  );
}

/** One queued track: the press-to-play button and, beside it, the boost button. */
function QueueRow({
  track,
  position,
  disabled,
  boostRequired,
  cooldown,
  onJump,
  onBoost,
}: {
  track: Track;
  /** 1-indexed. */
  position: number;
  disabled: boolean;
  boostRequired: number;
  cooldown?: { cooling: boolean; guard: (run: () => void) => () => void };
  onJump: (position: number, uri: string | null) => void;
  onBoost?: (position: number, uri: string | null) => void;
}) {
  const label = `Play now: ${track.title ?? "Unknown track"}`;
  const jump = (cooldown?.guard ?? ((run: () => void) => run))(() => {
    if (!disabled) onJump(position, track.uri);
  });

  return (
    <li className="vibe-queue-row" style={disabled ? { ...S.queueRow, opacity: 0.6 } : S.queueRow}>
      {/* A real button inside the list item, so the list stays a list for a screen reader and
          the boost button beside it is not nested in another control. */}
      <button
        type="button"
        className="vibe-queue-play"
        style={disabled ? { ...S.queuePlay, cursor: "default" } : S.queuePlay}
        aria-label={label}
        disabled={disabled}
        onClick={jump}
      >
        <QueueArt src={thumbnailSrc(track.thumbnail)} />
        <span style={S.queueTitle}>
          {track.title ?? "Unknown track"}
          {track.author && <span style={S.queueAuthor}> · {track.author}</span>}
        </span>
        <span style={S.queueTime}>{track.isStream ? "live" : formatDuration(track.lengthMs ?? 0)}</span>
      </button>
      {/* Every listener can boost; only the first upcoming track has nowhere to go. */}
      {onBoost && position >= 2 ? (
        <button
          type="button"
          className="vibe-queue-boost"
          style={(track.boosts ?? 0) > 0 ? { ...S.boostBtn, ...S.boostBtnActive } : S.boostBtn}
          disabled={disabled}
          aria-label={`Boost: ${track.title ?? "Unknown track"}${
            (track.boosts ?? 0) > 0 ? `, ${track.boosts} of ${boostRequired} boosts` : ""
          }`}
          onClick={() => onBoost(position, track.uri)}
        >
          <BoostIcon />
          {(track.boosts ?? 0) > 0 && (
            <span>
              {track.boosts}/{boostRequired}
            </span>
          )}
        </button>
      ) : (
        <span />
      )}
    </li>
  );
}

/**
 * A row's key is its link plus how many of the same link came before it, so a shuffle moves the
 * existing rows instead of remounting every one, and the same song queued twice still gets two keys.
 */
export function queueRowKeys(tracks: Track[]): string[] {
  const seen = new Map<string, number>();
  return tracks.map((track) => {
    const id = track.uri ?? "";
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    return `${id}#${n}`;
  });
}

function QueueArt({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div style={S.queueArtPlaceholder}>
        <MusicNoteIcon size={14} />
      </div>
    );
  }

  return <img src={src} alt="" loading="lazy" decoding="async" style={S.queueArtImage} onError={() => setFailed(true)} />;
}
