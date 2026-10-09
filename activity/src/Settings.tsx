import { useEffect, useRef, type RefObject } from "react";
import { useActivitySync } from "./useActivitySync";
import { BackIcon } from "./icons";
import { Fact, Facts, FactsSkeleton } from "./Facts";

type Props = {
  sync: Pick<ReturnType<typeof useActivitySync>, "guildContext" | "notice" | "requestGuildContext" | "status">;
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
  const { guildContext, notice, requestGuildContext, status } = sync;
  const live = status.phase === "ready";
  const heading = useRef<HTMLHeadingElement>(null);

  // Asked again whenever the connection comes back, for the same reason as the profile.
  useEffect(() => {
    requestGuildContext();
  }, [requestGuildContext, live]);

  // Moving here replaced the whole screen: start at the heading, not at the top of the page.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  if (!guildContext) {
    return (
      <div className="vibe-panel vibe-arrive">
        <PanelHeader onBack={onBack} headingRef={heading} />
        <p className="vibe-hint">{notice ?? (live ? "Loading settings…" : "Waiting for Vibe to reconnect…")}</p>
        <FactsSkeleton count={6} />
      </div>
    );
  }

  const { config, overridden, roles, channels } = guildContext;
  const nameOf = (list: { id: string; name: string }[], id: string, gone: string) =>
    list.find((item) => item.id === id)?.name ?? gone;

  const channelNames = (ids: string[]) => ids.map((id) => `#${nameOf(channels, id, "a deleted channel")}`);
  const roleNames = (ids: string[]) => ids.map((id) => nameOf(roles, id, "a deleted role"));
  // Only where it is true: a badge on every row is a badge nobody reads.
  const own = (field: string) => (overridden.includes(field) ? <span className="vibe-badge">this bot only</span> : undefined);

  return (
    <div className="vibe-panel vibe-arrive">
      <PanelHeader onBack={onBack} headingRef={heading} />
      {notice && <p className="vibe-notice vibe-notice--start">{notice}</p>}

      <p className="vibe-panel__intro">
        What this bot is set to do in this server. To change any of it, use{" "}
        <code className="vibe-code" translate="no">/config</code> in a text channel.
      </p>

      <Facts>
        <Fact label="Voice channels it may join" badge={own("voiceChannels")}>
          {list(channelNames(config.voiceChannels), "Any voice channel")}
        </Fact>
        <Fact label="Channels its commands work in" badge={own("commandsChannels")}>
          {list(channelNames(config.commandsChannels), "Every channel")}
        </Fact>
        <Fact label="DJ roles" hint="Skip without a vote, and bypass most restrictions.">
          {list(roleNames(config.djRoles), "Nobody — everything is put to a vote")}
        </Fact>
        <Fact label="“Now playing” messages" badge={own("announcements")}>
          {config.announcements ? "On" : "Off"}
        </Fact>
        <Fact label="Autoplay" hint="Keeps playing when the queue runs out." badge={own("autoplay")}>
          {config.autoplay
            ? config.autoplayRoomTaste
              ? "On, and it may follow listeners' taste"
              : "On, from what was last playing only"
            : "Off"}
        </Fact>
        <Fact label="Blocked">
          {config.blockedUserCount + config.blockedRoleCount === 0
            ? "Nobody"
            : [
                config.blockedUserCount && plural(config.blockedUserCount, "person", "people"),
                config.blockedRoleCount && plural(config.blockedRoleCount, "role", "roles"),
              ]
                .filter(Boolean)
                .join(" and ")}
        </Fact>
        <Fact label="Audit log" hint="Where configuration changes are recorded.">
          {config.logChannelId ? `#${nameOf(channels, config.logChannelId, "a deleted channel")}` : "Off"}
        </Fact>
      </Facts>
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A list as a sentence, or what "empty" means here — never a bare "none", which reads as broken. */
const list = (names: string[], whenEmpty: string) => (names.length ? names.join(", ") : whenEmpty);

function PanelHeader({ onBack, headingRef }: { onBack: () => void; headingRef?: RefObject<HTMLHeadingElement | null> }) {
  return (
    <div className="vibe-panel__head">
      <button className="vibe-btn vibe-btn--tonal" onClick={onBack} aria-label="Back">
        <BackIcon />
      </button>
      <h1 ref={headingRef} tabIndex={-1} className="vibe-panel__title">
        Settings
      </h1>
    </div>
  );
}
