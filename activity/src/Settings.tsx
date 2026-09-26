import { useEffect, type CSSProperties, type ReactNode } from "react";
import { useActivitySync } from "./useActivitySync";
import { BackIcon } from "./icons";

type Props = {
  sync: Pick<ReturnType<typeof useActivitySync>, "guildContext" | "notice" | "requestGuildContext">;
  onBack: () => void;
};

/**
 * **Read-only.** Nothing here writes, and nothing new should be added.
 *
 * Discord's native role and channel selects only exist inside a slash command, so editing the same
 * fields `/config` writes from here would make guild settings writable from three places —
 * `/config`, this panel and the website dashboard. Every new setting would then be three
 * implementations or a silent inconsistency, and this is the surface with the least claim to
 * them: its audience is people listening in a voice channel, not administrators.
 *
 * So it answers the question a listener actually has, which `/config` answers badly by being
 * somewhere else: **can this bot play here, and why not?** Editing lives in `/config`, in one place,
 * and the header says so.
 *
 * **These are this bot's settings**, not the server's: the values arrive already resolved through
 * that instance's overrides, and anything it overrides is marked, so a value that differs from what
 * an admin set server-wide never reads as the server's own.
 *
 * It stays manager-gated even though it only reads. Which channels a bot is confined to and which
 * roles skip the vote are not secrets, but they are not a listener's business either, and the
 * server re-checks ManageGuild on every request regardless of what this component does.
 */
export default function Settings({ sync, onBack }: Props) {
  const { guildContext, notice, requestGuildContext } = sync;

  useEffect(() => {
    requestGuildContext();
  }, [requestGuildContext]);

  if (!guildContext) {
    return (
      <div style={S.panel} className="vibe-fade-in">
        <PanelHeader onBack={onBack} />
        <p style={S.loading}>{notice ?? "Loading settings…"}</p>
      </div>
    );
  }

  const { config, overridden, roles, channels } = guildContext;
  const nameOf = (list: { id: string; name: string }[], id: string) =>
    list.find((item) => item.id === id)?.name ?? "a deleted channel";

  const channelNames = (ids: string[]) => ids.map((id) => `#${nameOf(channels, id)}`);
  const roleNames = (ids: string[]) => ids.map((id) => nameOf(roles, id));
  const isOwn = (field: string) => overridden.includes(field);

  return (
    <div style={S.panel} className="vibe-fade-in">
      <PanelHeader onBack={onBack} />
      {notice && <p style={S.notice}>{notice}</p>}

      <p style={S.intro}>
        What this bot is set to do in this server. To change any of it, use{" "}
        <code style={S.code}>/config</code> in a text channel.
      </p>

      <Row
        title="Voice channels it may join"
        own={isOwn("voiceChannels")}
        value={list(channelNames(config.voiceChannels), "Any voice channel")}
      />
      <Row
        title="Channels its commands work in"
        own={isOwn("commandsChannels")}
        value={list(channelNames(config.commandsChannels), "Every channel")}
      />
      <Row
        title="DJ roles"
        hint="Skip without a vote, and bypass most restrictions."
        value={list(roleNames(config.djRoles), "Nobody — everything is put to a vote")}
      />
      <Row
        title="“Now playing” messages"
        own={isOwn("announcements")}
        value={config.announcements ? "On" : "Off"}
      />
      <Row
        title="Autoplay"
        hint="Keeps playing when the queue runs out."
        own={isOwn("autoplay")}
        value={
          config.autoplay
            ? config.autoplayRoomTaste
              ? "On, and it may follow listeners' taste"
              : "On, from what was last playing only"
            : "Off"
        }
      />
      <Row
        title="Blocked"
        value={
          config.blockedUserCount + config.blockedRoleCount === 0
            ? "Nobody"
            : [
                config.blockedUserCount && plural(config.blockedUserCount, "person", "people"),
                config.blockedRoleCount && plural(config.blockedRoleCount, "role", "roles"),
              ]
                .filter(Boolean)
                .join(" and ")
        }
      />
      <Row
        title="Audit log"
        hint="Where configuration changes are recorded."
        value={config.logChannelId ? `#${nameOf(channels, config.logChannelId)}` : "Off"}
      />
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A list as a sentence, or what "empty" means here — never a bare "none", which reads as broken. */
const list = (names: string[], whenEmpty: string) => (names.length ? names.join(", ") : whenEmpty);

function Row({
  title,
  hint,
  value,
  own = false,
}: {
  title: string;
  hint?: string;
  value: ReactNode;
  own?: boolean;
}) {
  return (
    <section style={S.section}>
      <h2 style={S.sectionTitle}>
        {title}
        {/* Only where it is true: a badge on every row is a badge nobody reads. */}
        {own && <span style={S.badge}>this bot only</span>}
      </h2>
      <p style={S.value}>{value}</p>
      {hint && <p style={S.sectionHint}>{hint}</p>}
    </section>
  );
}

function PanelHeader({ onBack }: { onBack: () => void }) {
  return (
    <div style={S.header}>
      <button className="vibe-icon-btn" style={S.backBtn} onClick={onBack} aria-label="Back">
        <BackIcon />
      </button>
      <h1 style={S.title}>Settings</h1>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  panel: { display: "flex", flexDirection: "column", gap: "1.1rem" },
  header: { display: "flex", alignItems: "center", gap: "0.8rem" },
  backBtn: {
    width: 36,
    height: 36,
    flexShrink: 0,
    background: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    color: "#f5f2f3",
  },
  title: { margin: 0, fontSize: "1.15rem", fontWeight: 700 },
  loading: { opacity: 0.55, fontSize: "0.85rem" },
  intro: { margin: 0, fontSize: "0.82rem", opacity: 0.6, lineHeight: 1.5 },
  code: {
    padding: "0.1rem 0.35rem",
    borderRadius: 5,
    background: "rgba(255,255,255,0.1)",
    fontSize: "0.78rem",
  },

  section: { display: "flex", flexDirection: "column", gap: "0.2rem" },
  sectionTitle: {
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "0.45rem",
    fontSize: "0.72rem",
    textTransform: "uppercase",
    opacity: 0.5,
    letterSpacing: "0.04em",
  },
  badge: {
    padding: "0.1rem 0.4rem",
    borderRadius: 999,
    background: "var(--vibe-accent)",
    // The play button's text colour, not white: the accent is lightened until `#0b0b0d` reads on it
    // (`theme.ts`), so white on a light or grey accent could not be read until it was selected.
    color: "#0b0b0d",
    fontSize: "0.6rem",
    letterSpacing: "0.02em",
    textTransform: "none",
    opacity: 0.9,
  },
  value: { margin: 0, fontSize: "0.9rem", lineHeight: 1.45 },
  sectionHint: { margin: 0, fontSize: "0.74rem", opacity: 0.4 },

  notice: {
    margin: 0,
    padding: "0.55rem 0.8rem",
    borderRadius: 8,
    background: "rgba(252, 54, 89, 0.14)",
    color: "#ffb3c0",
    fontSize: "0.8rem",
  },
};
