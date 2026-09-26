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
  onJump,
  onBoost,
}: {
  tracks: Track[];
  total?: number;
  disabled?: boolean;
  /** How many boosts make a track move to next. */
  boostRequired?: number;
  onJump: (position: number) => void;
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

  return (
    <section style={S.queueSection} className="vibe-queue-rail vibe-fade-in">
      <h2 style={S.heading}>Up next · {total}</h2>
      {total > tracks.length && (
        <p style={S.hint}>
          Showing the first {tracks.length} of {total}.
        </p>
      )}
      <ol style={S.queue}>
        {tracks.map((track, i) => {
          // 1-indexed to match QueueService.jump()'s position argument.
          const position = i + 1;
          const label = `Play now: ${track.title ?? "Unknown track"}`;
          const jump = () => {
            if (!disabled) onJump(position);
          };

          return (
            <li
              key={`${track.uri}-${i}`}
              className="vibe-queue-row"
              style={disabled ? { ...S.queueRow, cursor: "default", opacity: 0.6 } : S.queueRow}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={label}
              aria-disabled={disabled || undefined}
              onClick={jump}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  jump();
                }
              }}
            >
              <QueueArt src={thumbnailSrc(track.thumbnail)} />
              <span style={S.queueTitle}>
                {track.title ?? "Unknown track"}
                {track.author && <span style={S.queueAuthor}> · {track.author}</span>}
              </span>
              <span style={S.queueTime}>
                {track.isStream ? "live" : formatDuration(track.lengthMs ?? 0)}
              </span>
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
                  onClick={(e) => {
                    // The row itself plays the track now; a boost must not also jump to it.
                    e.stopPropagation();
                    onBoost(position, track.uri);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
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
        })}
      </ol>
    </section>
  );
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
