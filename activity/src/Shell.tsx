import type { CSSProperties, ReactNode } from "react";
import type { Theme } from "./theme";
import { VibeMarkIcon } from "./icons";
import { S } from "./playerStyles";

/**
 * Full-bleed shell on a near-black base with a soft ambient glow in the instance's own
 * accent color, pinned behind independently-scrolling content.
 *
 * Deliberately not a blurred track-thumbnail backdrop: blurring an arbitrary, unpredictable-quality
 * image is a coin flip — a low-res or oddly-cropped thumbnail just turns to mud. A designed
 * gradient looks intentional on every track, and a near-black base is neutral enough to suit
 * every instance's accent.
 */
export function Shell({
  children,
  theme,
  backdrop,
  floored = false,
}: {
  children: ReactNode;
  theme: Theme;
  /** A transport bar is pinned to the bottom, so a backdrop that stands on a floor stands on its top edge. */
  floored?: boolean;
  /** `"waves"` | `"marks"` | null. The same vocabulary as the rank card, deliberately. */
  backdrop?: string | null;
}) {
  const mainStyle: CSSProperties = {
    ...S.main,
    // Consumed by player.css's .vibe-range / .vibe-play-btn rules and by S.eyebrow's
    // color below, all via var(--vibe-accent) — one place decides the instance's color,
    // everything downstream inherits it through normal CSS custom-property inheritance.
    ["--vibe-accent" as string]: theme.accent,
    ["--vibe-accent-hover" as string]: theme.accentHover,
  };

  return (
    <main style={mainStyle} className="vibe-app">
      {/* Gradient and breakpoint-dependent position both live in player.css — it has to
          follow the artwork across the layout change, which inline styles can't express. */}
      <div className="vibe-glow" />
      {/* A separate layer from the glow rather than more gradients on it. The glow is ambient
          light and has to stay under everything at low alpha; a *pattern* needs its own element so
          it can be swapped, removed, or absent entirely without touching the lighting. */}
      {backdrop ? <div className={`vibe-backdrop vibe-backdrop--${backdrop}${floored ? " vibe-backdrop--floored" : ""}`} /> : null}
      {children}
    </main>
  );
}

export function CenterMessage({ children, error }: { children: ReactNode; error?: boolean }) {
  return <div style={{ ...S.centerMessage, ...(error ? S.centerMessageError : null) }}>{children}</div>;
}

/**
 * The very first thing anyone sees, however briefly — the Discord SDK handshake plus the
 * WebSocket connect. A centered, breathing brand mark reads as "the app is alive and working"
 * rather than a plain loading string, without needing a skeleton shaped like content the app
 * doesn't know the dimensions of yet (there's no track, no queue length, nothing to outline).
 * Tinted with the instance's own accent so this, like everything else, reads as *this* bot.
 */
export function ConnectingState({ accent, reason }: { accent: string; reason?: string | null }) {
  return (
    <div style={S.connectingWrap}>
      <div className="vibe-mark-pulse" style={{ color: accent }}>
        <VibeMarkIcon size={56} />
      </div>
      <span style={S.connectingLabel}>Connecting…</span>
      {/* Why it is still waiting, when the server said. Without this a refused connection looked
          identical to a slow one, forever. */}
      {reason && (
        <span role="status" style={S.hintLine}>
          {reason}
        </span>
      )}
    </div>
  );
}

/**
 * `role="status"` so a screen reader is told. Notices are the only feedback for a refused control —
 * "Only a DJ can control playback here", "Not connected to Vibe right now" — and they are transient
 * text that appears somewhere the user is not looking. Without a live region they simply never
 * existed for anyone not watching that spot on the screen.
 *
 * Polite rather than assertive: it should wait for a gap rather than interrupt.
 */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p style={S.notice} role="status">
      {children}
    </p>
  );
}
