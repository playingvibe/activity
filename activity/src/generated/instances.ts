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
    "accent": "#E05570",
    "accentHover": "#ec6a83"
  },
  "1533281867523031070": {
    "name": "Vibe 2",
    "accent": "#4577B8",
    "accentHover": "#5A8ECC"
  },
  "1001935021436850207": {
    "name": "Vibe 3",
    "accent": "#D9B15C",
    "accentHover": "#e8c477"
  },
  "820636341788344321": {
    "name": "Vibe Beta",
    "accent": "#559E68",
    "accentHover": "#6bb37e"
  }
};

/** For any client id not listed — the same object as the flagship's entry, not a copy. */
export const FALLBACK_THEME: Theme = INSTANCE_THEMES["815329807377498153"];
