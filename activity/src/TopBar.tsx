import { useState } from "react";
import { ALL_THEMES, type Theme } from "./theme";
import { ProfileIcon, SettingsIcon, QueueIcon } from "./icons";
import { S } from "./playerStyles";
import type { View } from "./Player";

export function ThemePicker({ current, onPick }: { current: Theme; onPick: (theme: Theme) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={S.devPicker}>
      <button
        className="vibe-icon-btn"
        style={{ ...S.devPickerBtn, background: current.accent }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Preview another instance's palette (dev only)"
        title={`Palette: ${current.name}`}
      />
      {open && (
        <div style={S.devPickerMenu}>
          {ALL_THEMES.map((option) => (
            <button
              key={option.name}
              className="vibe-icon-btn"
              style={{
                ...S.devPickerOption,
                fontWeight: option.name === current.name ? 700 : 400,
              }}
              onClick={() => {
                onPick(option);
                setOpen(false);
              }}
            >
              <span style={{ ...S.devPickerSwatch, background: option.accent }} />
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
    <div style={S.topBar}>
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
            onClick={() => onOpen("settings")}
            aria-label="Settings"
          >
            <SettingsIcon />
          </button>
        )}
        <button
          className="vibe-icon-btn"
          style={S.topBarBtn}
          onClick={() => onOpen("profile")}
          aria-label="Your profile"
        >
          <ProfileIcon />
        </button>
      </div>
    </div>
  );
}
