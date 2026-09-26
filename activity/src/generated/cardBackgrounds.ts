/**
 * GENERATED FILE — do not edit.
 *
 * Written by scripts/sync-web-shared.js from src/domain/constants/CardBackgrounds.js, which is the source of truth.
 * Edit that file and run `npm run sync:web`.
 */

export const CARD_BACKGROUND_KEYS = ["waves", "marks", "bars", "grid", "aurora"] as const;

export type CardBackground = (typeof CARD_BACKGROUND_KEYS)[number];

/** Narrowing guard: anything arriving over the socket is untrusted until it matches a key. */
export function isCardBackground(value: unknown): value is CardBackground {
  return (CARD_BACKGROUND_KEYS as readonly string[]).includes(value as string);
}
