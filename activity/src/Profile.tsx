import { useEffect, useRef, type CSSProperties } from "react";
import { useActivitySync, type ProfileBadge, type ProfileLevel } from "./useActivitySync";
import { BackIcon } from "./icons";

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
    <div style={S.panel} className="vibe-fade-in">
      <button className="vibe-icon-btn" style={S.backBtn} onClick={onBack} aria-label="Back">
        <BackIcon />
      </button>

      <div style={S.identity}>
        {identity?.avatarUrl ? (
          <img src={identity.avatarUrl} alt="" style={S.avatar} />
        ) : (
          <div style={S.avatarPlaceholder}>
            {(identity?.globalName ?? identity?.username ?? "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <h1 ref={heading} tabIndex={-1} style={S.name}>
          {identity?.globalName ?? identity?.username ?? "…"}
        </h1>
        {identity?.globalName && <p style={S.handle}>@{identity.username}</p>}
      </div>

      {profile ? (
        <div style={S.stats}>
          {profile.level && <LevelCard level={profile.level} />}
          <StatCard label="Total listening time" value={formatLongDuration(profile.stats.totalListeningTime)} />
          <div style={S.statRow}>
            <StatCard label="Current streak" value={formatDays(profile.stats.currentStreak)} />
            <StatCard label="Longest streak" value={formatDays(profile.stats.longestStreak)} />
          </div>
          {profile.stats.sessionCount !== undefined && (
            <StatCard label="Tracks listened" value={profile.stats.sessionCount.toLocaleString()} />
          )}
          {profile.badges && <Badges badges={profile.badges} />}
          {/* plan is always null today: entitlements exist, but the profile panel does not surface
              premium yet. This is the reserved spot for it, not a fallback UI to design around. */}
        </div>
      ) : (
        <p style={S.loading}>{notice ?? (live ? "Loading stats…" : "Waiting for Vibe to reconnect…")}</p>
      )}
    </div>
  );
}

/**
 * The level and how far through it: the bot sends the answer, never the thresholds, so this cannot
 * disagree with `/rank` the day the curve changes. A new listener is level 1 with an empty bar,
 * which reads as a start.
 */
function LevelCard({ level }: { level: ProfileLevel }) {
  const percent = Math.round(Math.max(0, Math.min(1, level.progress)) * 100);

  return (
    <div style={S.levelCard}>
      <div style={S.levelRow}>
        <p style={S.levelName}>Level {level.level}</p>
        <p style={S.levelNext}>
          {level.remainingMs === null
            ? "Max level"
            : `${formatLongDuration(level.remainingMs)} to level ${level.level + 1}`}
        </p>
      </div>
      <div
        style={S.levelTrack}
        role="progressbar"
        aria-label={`Progress to level ${level.level + 1}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div style={{ ...S.levelFill, width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** Earned tiers as coloured pills; the empty state says where it starts rather than showing nothing. */
function Badges({ badges }: { badges: ProfileBadge[] }) {
  return (
    <div style={S.badgeCard}>
      <p style={S.badgeTitle}>Badges</p>
      {badges.length ? (
        <div style={S.badgeRow}>
          {badges.map((badge) => (
            <span key={badge.name} style={{ ...S.badge, borderColor: badge.color, color: badge.color }}>
              {badge.name}
            </span>
          ))}
        </div>
      ) : (
        <p style={S.badgeEmpty}>None yet. Keep listening and your first one lands soon.</p>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={S.statCard}>
      <p style={S.statValue}>{value}</p>
      <p style={S.statLabel}>{label}</p>
    </div>
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

const S: Record<string, CSSProperties> = {
  panel: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    alignItems: "center",
    textAlign: "center",
    paddingTop: "0.5rem",
  },
  backBtn: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 36,
    height: 36,
    background: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    color: "#f5f2f3",
  },
  identity: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" },
  avatar: { width: 84, height: 84, borderRadius: "50%", objectFit: "cover" },
  avatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: "50%",
    background: "var(--vibe-accent)",
    color: "#0b0b0d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.8rem",
    fontWeight: 700,
  },
  name: { margin: "0.4rem 0 0", fontSize: "1.2rem", fontWeight: 700 },
  handle: { margin: 0, opacity: 0.55, fontSize: "0.85rem" },
  stats: { display: "flex", flexDirection: "column", gap: "0.6rem", width: "100%", maxWidth: 340 },
  statRow: { display: "flex", gap: "0.6rem" },
  statCard: {
    flex: 1,
    padding: "0.9rem",
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
  },
  levelCard: {
    padding: "0.9rem",
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
    textAlign: "left",
  },
  levelRow: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.6rem" },
  levelName: { margin: 0, fontSize: "1.3rem", fontWeight: 700 },
  levelNext: { margin: 0, fontSize: "0.72rem", opacity: 0.6 },
  levelTrack: {
    marginTop: "0.6rem",
    height: 6,
    borderRadius: 999,
    background: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  levelFill: { height: "100%", borderRadius: 999, background: "var(--vibe-accent)" },
  badgeCard: { padding: "0.9rem", borderRadius: 12, background: "rgba(255,255,255,0.06)", textAlign: "left" },
  badgeTitle: { margin: 0, fontSize: "0.72rem", opacity: 0.6 },
  badgeRow: { display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.6rem" },
  badge: {
    padding: "0.25rem 0.65rem",
    borderRadius: 999,
    border: "1px solid",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  badgeEmpty: { margin: "0.6rem 0 0", fontSize: "0.85rem", opacity: 0.7 },
  statValue: { margin: 0, fontSize: "1.3rem", fontWeight: 700 },
  statLabel: { margin: "0.2rem 0 0", fontSize: "0.72rem", opacity: 0.6 },
  loading: { opacity: 0.5, fontSize: "0.85rem" },
};
