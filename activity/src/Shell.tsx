import type { CSSProperties, ReactNode } from "react";
import type { Theme } from "./theme";
import { VibeMarkIcon } from "./icons";

/**
 * The shell every screen is drawn in: the near-black ground, the accent for this instance or this
 * viewer, and the two layers behind the content.
 *
 * The glow is the instance's tone along the top of a view that has nothing else to light it
 * (connecting, nothing playing, the panels). The playing view is lit by its cover instead (`Wash`
 * in Transport.tsx): blurred far past the point where a low-quality thumbnail could show, and under
 * a scrim that decides the contrast whatever the cover is.
 */
export function Shell({
  children,
  theme,
  backdrop,
}: {
  children: ReactNode;
  theme: Theme;
  /** A key from `CARD_BACKGROUND_KEYS`, or null. The same vocabulary as the rank card, deliberately. */
  backdrop?: string | null;
}) {
  // The one place that decides the colour: every accent token in tokens.css derives from these two.
  const accent = { "--accent": theme.accent, "--accent-hover": theme.accentHover } as CSSProperties;

  return (
    <main style={accent} className="vibe-app">
      <div className="vibe-glow" />
      {/* A separate layer from the glow rather than more gradients on it. The glow is ambient
          light and has to stay under everything at low alpha; a *pattern* needs its own element so
          it can be swapped, removed, or absent entirely without touching the lighting. */}
      {backdrop ? <div className={`vibe-backdrop vibe-backdrop--${backdrop}`} /> : null}
      {children}
    </main>
  );
}

/**
 * One thing to say, in the middle of the frame, as the page's heading (every screen needs one, and these
 * have no other). `children` is what goes under it. `mark` puts the brand above, for a screen that is an invitation.
 */
export function CenterMessage({ title, children, error, mark }: { title: ReactNode; children?: ReactNode; error?: boolean; mark?: boolean }) {
  return (
    <div className={`vibe-message${error ? " vibe-message--error" : ""}`}>
      {mark && (
        <span className="vibe-message__mark">
          <VibeMarkIcon size={40} />
        </span>
      )}
      <h1 className="vibe-message__title">{title}</h1>
      {children}
    </div>
  );
}

/**
 * The very first thing anyone sees, however briefly — the Discord SDK handshake plus the
 * WebSocket connect. A centered, breathing brand mark reads as "the app is alive and working"
 * rather than a plain loading string, without needing a skeleton shaped like content the app
 * doesn't know the dimensions of yet (there's no track, no queue length, nothing to outline).
 * Tinted with the instance's own accent so this, like everything else, reads as *this* bot.
 */
export function ConnectingState({ reason }: { reason?: string | null }) {
  return (
    <div className="vibe-connecting">
      <div className="vibe-connecting__mark">
        <VibeMarkIcon size={56} />
      </div>
      <h1 className="vibe-hint vibe-message__title">Connecting…</h1>
      {/* Why it is still waiting, when the server said. So a refused connection does not look
          like a slow one. Always mounted: a live region is announced when its text
          changes, and one inserted with its text already in it often is not. */}
      <span role="status" className="vibe-hint">
        {reason ?? ""}
      </span>
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
export function Notice({ children }: { children?: ReactNode }) {
  // Always in the page, empty when there is nothing to say, and only its text changes. A region that
  // appears with its text already inside it is the case screen readers commonly stay silent on.
  return (
    <p className={children ? "vibe-notice" : "vibe-sr"} role="status">
      {children}
    </p>
  );
}
