/**
 * GENERATED FILE — do not edit.
 *
 * Written by scripts/sync-web-shared.js from src/domain/constants/InstanceTheme.js, which is the source of truth.
 * Edit that file and run `npm run sync:web`.
 */

export type Theme = { name: string; accent: string; accentHover: string };

/** Every instance's palette, by client id. */
export const INSTANCE_THEMES: Record<string, Theme> = {
  "800075471290236968": {
    "name": "Vibe Dev",
    "accent": "#FFFFFF",
    "accentHover": "#D8DEE9"
  },
  "815329807377498153": {
    "name": "Vibe",
    "accent": "#FF295E",
    "accentHover": "#ff4371"
  },
  "1533281867523031070": {
    "name": "Vibe 2",
    "accent": "#1A79FF",
    "accentHover": "#3589FF"
  },
  "1001935021436850207": {
    "name": "Vibe 3",
    "accent": "#FFC20A",
    "accentHover": "#ffc927"
  },
  "820636341788344321": {
    "name": "Vibe Beta",
    "accent": "#00A331",
    "accentHover": "#1fae4a"
  }
};

/** For any client id not listed — the same object as the flagship's entry, not a copy. */
export const FALLBACK_THEME: Theme = INSTANCE_THEMES["815329807377498153"]!;
