import { ProfileIcon, SettingsIcon, QueueIcon } from "./icons";
import type { View } from "./Player";

type ToolsProps = {
  canManageGuild: boolean;
  onOpen: (view: View) => void;
  queueOpen?: boolean;
  onToggleQueue?: () => void;
  queueCount?: number;
};

/**
 * The buttons that lead away from the song: the queue toggle, settings, profile.
 *
 * Profile always shown; Settings only for a user the client-side hint says can manage the
 * guild — the real gate is server-side, this only avoids a dead button for everyone else.
 * The queue toggle only where the caller passes one: it means something only where the queue is
 * a rail that can be put away.
 *
 * Rendered once, wherever the view has room for them (the end of the transport strip on a wide
 * pane, the corner of the stage otherwise), so the ids Back returns focus to are never doubled.
 */
export function Tools({ canManageGuild, onOpen, queueOpen, onToggleQueue, queueCount }: ToolsProps) {
  return (
    <>
      {onToggleQueue && (
        <button
          className="vibe-btn"
          onClick={onToggleQueue}
          aria-pressed={queueOpen}
          aria-label={queueOpen ? "Hide queue" : `Show queue${queueCount ? ` (${queueCount})` : ""}`}
        >
          <QueueIcon size={20} />
        </button>
      )}
      {canManageGuild && (
        <button className="vibe-btn" id="vibe-open-settings" onClick={() => onOpen("settings")} aria-label="Settings">
          <SettingsIcon size={20} />
        </button>
      )}
      <button className="vibe-btn" id="vibe-open-profile" onClick={() => onOpen("profile")} aria-label="Your profile">
        <ProfileIcon size={20} />
      </button>
    </>
  );
}

/** The same buttons as a bar of their own, for a view with no transport strip to hold them. */
export function TopBar(props: ToolsProps) {
  return (
    <div className="vibe-topbar">
      <Tools {...props} />
    </div>
  );
}
