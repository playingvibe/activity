import { ProfileIcon, SettingsIcon, QueueIcon } from "./icons";
import { S } from "./playerStyles";
import type { View } from "./Player";

/** Profile always shown; Settings only for a user the client-side hint says can manage the
 * guild — the real gate is server-side, this only avoids a dead button for everyone else. */
export function TopBar({
  canManageGuild,
  onOpen,
  queueOpen,
  onToggleQueue,
  queueCount,
}: {
  canManageGuild: boolean;
  onOpen: (view: View) => void;
  queueOpen?: boolean;
  onToggleQueue?: () => void;
  queueCount?: number;
}) {
  return (
    <div style={S.topBar} className="vibe-topbar">
      <div style={S.topBarBtns}>
        {onToggleQueue && (
          <button
            className="vibe-icon-btn vibe-queue-toggle"
            style={{ ...S.topBarBtn, color: queueOpen ? "var(--vibe-accent)" : "#f5f2f3" }}
            onClick={onToggleQueue}
            aria-pressed={queueOpen}
            aria-label={queueOpen ? "Hide queue" : `Show queue${queueCount ? ` (${queueCount})` : ""}`}
          >
            <QueueIcon />
          </button>
        )}
        {canManageGuild && (
          <button
            className="vibe-icon-btn"
            style={S.topBarBtn}
            id="vibe-open-settings"
            onClick={() => onOpen("settings")}
            aria-label="Settings"
          >
            <SettingsIcon />
          </button>
        )}
        <button
          className="vibe-icon-btn"
          style={S.topBarBtn}
          id="vibe-open-profile"
          onClick={() => onOpen("profile")}
          aria-label="Your profile"
        >
          <ProfileIcon />
        </button>
      </div>
    </div>
  );
}
