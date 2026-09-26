import { FALLBACK_THEME, INSTANCE_THEMES, type Theme } from "./generated/instances";

export type { Theme };

// Generated from src/domain/constants/InstanceTheme.js, the palette's one source; the reasoning
// behind the colours lives there. `FALLBACK` is the flagship's entry itself, which is what lets
// ALL_THEMES below filter it out by identity.
const FALLBACK: Theme = FALLBACK_THEME;

/**
 * One palette per bot instance, keyed by Discord application (client) ID — the same value
 * that appears in every invite link and in this Activity's own hostname
 * (`<clientId>.discordsays.com`), so it's public information, not a secret baked into a
 * public bundle.
 *
 * Falls back to the main Vibe palette for any client ID not listed here, so an instance
 * whose real ID isn't wired in yet (or a future one) still renders something coherent
 * instead of breaking.
 */
/** The development instance's client id. Auto-enables the dev palette picker — see isDevMode(). */
export const DEV_CLIENT_ID = "800075471290236968";

const THEMES: Record<string, Theme> = INSTANCE_THEMES;

export function resolveTheme(clientId: string): Theme {
  return THEMES[clientId] ?? FALLBACK;
}

/**
 * Every palette, for the temporary `?dev=1` theme picker in Player.tsx — the only way to
 * eyeball an instance's colours without deploying under that instance's client ID.
 *
 * TEMPORARY: delete this alongside the picker once the palettes are signed off.
 */
export const ALL_THEMES: Theme[] = [FALLBACK, ...Object.values(THEMES).filter((t) => t !== FALLBACK)];

/**
 * A theme from an arbitrary accent, for the per-user Activity colour.
 *
 * **The hover is derived, not asked for.** Every built-in palette pairs an accent with a hand-tuned
 * hover, but a colour picker gives one value — and asking someone to choose two colours that must
 * relate correctly is asking them to do design work. Lightening in HSL by a fixed step reproduces
 * what the hand-tuned pairs already do (each `accentHover` here is its accent, lighter).
 *
 * **The accent is lightened until it is readable.** It can look as if no guard is needed, since
 * `player.css` only mixes the accent into surfaces at 9% and into the ambient glow at 2-9% — but
 * `.vibe-play-btn` paints `background: var(--vibe-accent)` at full strength with `#0b0b0d` text, and
 * the loop button renders the accent *as* text on a near-black surface. A dark accent therefore made
 * the transport's primary control invisible, and the picker accepts any hex at all.
 *
 * Clamped here rather than in the picker: this is the one place an arbitrary colour becomes the
 * palette, so a value arriving from anywhere — a saved preference, a future import — passes through
 * it. Only lightness moves; the hue and saturation someone chose are theirs.
 */
export function themeFromAccent(accent: string): Theme {
  if (!/^#[0-9a-f]{6}$/i.test(accent)) return { ...FALLBACK, name: "Custom" };

  const readable = ensureReadable(accent);
  return { name: "Custom", accent: readable, accentHover: lighten(readable, 0.12) };
}

/** What the play button prints on top of the accent. */
const CONTROL_TEXT = "#0b0b0d";

/**
 * WCAG AA for large text and UI components. The play glyph is large and bold, so 4.5 is comfortably
 * above the 3:1 that would strictly apply — worth it, because this same value is also read as text
 * on the loop button.
 */
const MIN_CONTRAST = 4.5;

/** Lightens the accent in place until the play button's icon can be read on it. */
function ensureReadable(accent: string): string {
  let out = accent;
  // Bounded rather than `while (true)`: pure white against #0b0b0d is about 19:1, so this converges
  // long before the cap, and a cap means a malformed value can never spin here.
  for (let i = 0; i < 40 && contrastRatio(out, CONTROL_TEXT) < MIN_CONTRAST; i += 1) {
    const next = lighten(out, 0.04);
    if (next === out) break;
    out = next;
  }
  return out;
}

/** @returns 1-21, per WCAG 2.1. */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/** @param amount 0..1, added to HSL lightness. */
function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h *= 60;
  if (h < 0) h += 360;

  const nl = Math.min(1, l + amount);
  const c = (1 - Math.abs(2 * nl - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = nl - c / 2;
  const [rr, gg, bb] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];

  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(rr)}${to(gg)}${to(bb)}`;
}
