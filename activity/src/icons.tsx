type IconProps = { size?: number };

/** Hand-drawn glyphs; no icon library. */

export function PlayIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="7,4 20,12 7,20" />
    </svg>
  );
}

export function PauseIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4" width="4.5" height="16" rx="1.5" />
      <rect x="13.5" y="4" width="4.5" height="16" rx="1.5" />
    </svg>
  );
}

export function SkipIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="5,5 15,12 5,19" />
      <rect x="16.5" y="5" width="2.5" height="14" rx="1" />
    </svg>
  );
}

export function PreviousIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="19,5 9,12 19,19" />
      <rect x="5" y="5" width="2.5" height="14" rx="1" />
    </svg>
  );
}

export function VolumeIcon({ size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4z" fill="currentColor" stroke="none" />
      <path d="M16 9c1.2 1 1.2 5 0 6" />
      <path d="M18.5 7c2.2 1.8 2.2 8.2 0 10" />
    </svg>
  );
}

/**
 * The Vibe brand mark — the master `resource/brand/vectors/v-mark.svg` placed in a 1254 box, `fill` swapped
 * from a fixed white to `currentColor` so it can be tinted (the loading state pulses it in the
 * instance's own accent, matching the per-instance palette everything else already follows).
 */
export function VibeMarkIcon({ size = 48 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 1254 1254" fill="currentColor" aria-hidden="true">
      <path d="M 827 325 C 868.97 325 903 359.03 903 401 C 903 413.94 899.76 426.12 894.06 436.78 L 670.14 879.51 C 655.86 908.81 625.79 929 591 929 C 552.33 929 519.49 904.06 507.68 869.39 L 357.44 462.88 C 353.28 452.39 351 440.96 351 429 C 351 378.19 392.19 337 443 337 C 483.8 337 518.39 363.56 530.44 400.33 L 587.22 563.06 C 591.77 575.19 603.47 583.81 617.19 583.81 C 628.96 583.81 639.24 577.46 644.79 568 L 760.11 364.9 C 772.96 341.14 798.09 325 827 325 Z" />
    </svg>
  );
}

/** Fallback glyph shown in place of missing or failed artwork. */
export function MusicNoteIcon({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" opacity={0.35}>
      <rect x="12.5" y="3" width="2" height="12.5" rx="1" />
      <path d="M14.5 3l4.5 1.3v2.2L14.5 5.2V3z" />
      <ellipse cx="10" cy="17" rx="3.5" ry="2.8" />
    </svg>
  );
}

export function BackIcon({ size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function ProfileIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7v1H4v-1z" />
    </svg>
  );
}

/** A ring + 8 teeth + hub: plain radiating lines with no ring or teeth would read as a
 * sun/starburst rather than a gear. */
export function SettingsIcon({ size = 18 }: IconProps) {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="5.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      {teeth.map((angle) => (
        <rect
          key={angle}
          x="10.8"
          y="2.8"
          width="2.4"
          height="3.6"
          rx="0.6"
          fill="currentColor"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
    </svg>
  );
}

/** An up arrow: "move this up the queue". */
export function BoostIcon({ size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
    </svg>
  );
}

export function ShuffleIcon({ size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h3.5L16 18h4.5" />
      <path d="M17 15l3.5 3-3.5 3" />
      <path d="M3 18h3.5l2.5-3" />
      <path d="M13 9l3-3h4.5" />
      <path d="M17 3l3.5 3-3.5 3" />
    </svg>
  );
}

/** The caller tints it via currentColor and marks "on" with a dot under the button (`.vibe-loop-btn`);
 * `mode: "track"` adds a small "1" badge, the convention Spotify and Apple Music use to tell
 * track repeat apart from queue repeat. */
export function LoopIcon({ size = 16, mode }: IconProps & { mode?: "track" | "queue" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 11a8 8 0 0 1 8-8h5M20 13a8 8 0 0 1-8 8H7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <polygon points="17,0.5 21,3 17,5.5" fill="currentColor" />
      <polygon points="10,18.5 6,21 10,23.5" fill="currentColor" />
      {mode === "track" && (
        <text x="12" y="14.5" fontSize="8" textAnchor="middle" fill="currentColor" fontWeight="700">
          1
        </text>
      )}
    </svg>
  );
}

/** Queue / up-next: a short list with a play caret, distinct from the transport glyphs. */
export function QueueIcon({ size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="16" y2="6" />
      <line x1="4" y1="12" x2="16" y2="12" />
      <line x1="4" y1="18" x2="12" y2="18" />
      <polygon points="17,15 22,18 17,21" fill="currentColor" stroke="none" />
    </svg>
  );
}
