import { useEffect, useRef, type CSSProperties } from "react";
import { useActivitySync, type ProfileBadge, type ProfileLevel } from "./useActivitySync";
import { BackIcon } from "./icons";
import { Fact, Facts, FactsSkeleton } from "./Facts";

type Props = {
  sync: Pick<ReturnType<typeof useActivitySync>, "identity" | "profile" | "requestProfile" | "notice" | "status">;
  onBack: () => void;
};

/** A user's own identity + listening stats. Requested fresh every time the panel opens. */
export default function Profile({ sync, onBack }: Props) {
  const { identity, profile, requestProfile, notice, status } = sync;
  const live = status.phase === "ready";
  const heading = useRef<HTMLHeadingElement>(null);

  // Asked again whenever the connection comes back: a request sent while it was down was dropped, and
  // nothing else would ever repeat it.
  useEffect(() => {
    requestProfile();
  }, [requestProfile, live]);

  // Moving here replaced the whole screen, so the button that was focused is gone: start at the heading.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <div className="vibe-panel vibe-arrive">
      <div className="vibe-panel__head">
        <button className="vibe-btn vibe-btn--tonal" onClick={onBack} aria-label="Back">
          <BackIcon />
        </button>
        {identity?.avatarUrl ? (
          <img src={identity.avatarUrl} alt="" className="vibe-avatar" />
        ) : (
          <div className="vibe-avatar">
            {(identity?.globalName ?? identity?.username ?? "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="vibe-panel__who">
          <h1 ref={heading} tabIndex={-1} className="vibe-panel__title vibe-clip">
            {identity?.globalName ?? identity?.username ?? "…"}
          </h1>
          {identity?.globalName && <p className="vibe-hint vibe-clip">@{identity.username}</p>}
        </div>
      </div>

      {profile ? (
        <>
          {profile.level && <Level level={profile.level} />}
          <Facts>
            <Fact label="Total listening time">{formatLongDuration(profile.stats.totalListeningTime)}</Fact>
            {profile.stats.sessionCount !== undefined && (
              <Fact label="Tracks listened">{profile.stats.sessionCount.toLocaleString()}</Fact>
            )}
            <Fact label="Current streak">{formatDays(profile.stats.currentStreak)}</Fact>
            <Fact label="Longest streak">{formatDays(profile.stats.longestStreak)}</Fact>
            {profile.badges && (
              <Fact label="Badges" wide>
                <Badges badges={profile.badges} />
              </Fact>
            )}
          </Facts>
          {/* plan is always null today: entitlements exist, but the profile panel does not surface
              premium yet. This is the reserved spot for it, not a fallback UI to design around. */}
        </>
      ) : (
        <>
          <p className="vibe-hint">{notice ?? (live ? "Loading stats…" : "Waiting for Vibe to reconnect…")}</p>
          <FactsSkeleton />
        </>
      )}
    </div>
  );
}

/**
 * The level and how far through it: the bot sends the answer, never the thresholds, so this cannot
 * disagree with `/rank` the day the curve changes. A new listener is level 1 with an empty bar,
 * which reads as a start.
 */
function Level({ level }: { level: ProfileLevel }) {
  const percent = Math.round(Math.max(0, Math.min(1, level.progress)) * 100);

  return (
    <div className="vibe-level">
      <div className="vibe-level__row">
        <p className="vibe-level__name">Level {level.level}</p>
        <p className="vibe-hint">
          {level.remainingMs === null
            ? "Max level"
            : `${formatLongDuration(level.remainingMs)} to level ${level.level + 1}`}
        </p>
      </div>
      <div
        className="vibe-meter"
        role="progressbar"
        aria-label={`Progress to level ${level.level + 1}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="vibe-meter__fill" style={{ transform: `scaleX(${percent / 100})` }} />
      </div>
    </div>
  );
}

/** Earned tiers as coloured pills; the empty state says where it starts rather than showing nothing. */
function Badges({ badges }: { badges: ProfileBadge[] }) {
  if (!badges.length) return <span className="vibe-hint">None yet. Keep listening and your first one lands soon.</span>;
  return (
    <span className="vibe-badges">
      {badges.map((badge) => (
        <span key={badge.name} className="vibe-badge" style={{ "--badge": badge.color } as CSSProperties}>
          {badge.name}
        </span>
      ))}
    </span>
  );
}

function formatDays(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** Human-scale duration for totals that can run into many hours — "3h 24m", not "3:24:00". */
function formatLongDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
