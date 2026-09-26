type IconProps = { size?: number };

/** Small, hand-drawn glyphs — no icon library dependency for four shapes. */

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
 * The Vibe brand mark — traced from `resource/brand/vectors/v-logo.svg`, `fill` swapped
 * from a fixed white to `currentColor` so it can be tinted (the loading state pulses it in the
 * instance's own accent, matching the per-instance palette everything else already follows).
 */
export function VibeMarkIcon({ size = 48 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 1254 1254" fill="currentColor" aria-hidden="true">
      <path d="M 877 349 L 858 344 L 835 344 L 817 348 L 792 361 L 773 379 L 765 390 L 754 410 L 666 623 L 653 646 L 646 653 L 641 655 L 632 653 L 624 643 L 620 634 L 550 415 L 538 390 L 527 377 L 518 370 L 506 364 L 490 360 L 464 360 L 449 363 L 424 373 L 406 385 L 392 399 L 380 419 L 376 434 L 376 452 L 379 465 L 409 537 L 436 608 L 536 884 L 548 909 L 563 930 L 575 940 L 589 947 L 608 950 L 626 948 L 650 938 L 669 925 L 690 904 L 705 885 L 731 843 L 753 799 L 910 457 L 917 439 L 920 424 L 920 404 L 916 388 L 905 369 L 892 357 Z" />
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

export function CheckIcon({ size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12.5l5.5 5.5L20 6.5" />
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

/** `active` (any mode) tints via currentColor from the caller; `mode: "track"` adds a small
 * "1" badge — the same convention Spotify/Apple Music use to tell track-repeat apart from
 * queue-repeat, which the bot's own /loop command doesn't visually distinguish today. */
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

export function CloseIcon({ size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M5 5l14 14M19 5L5 19" />
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
