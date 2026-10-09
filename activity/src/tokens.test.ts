import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INSTANCE_THEMES } from "./generated/instances";
import { resolveTheme, themeFromAccent } from "./theme";

/**
 * The contrast of every pair the stylesheets are allowed to make, for every palette. The values are
 * read from tokens.css itself, so a token cannot be changed without this being asked again.
 */
const css = readFileSync(new URL("./styles/tokens.css", import.meta.url), "utf8");

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(css);
  if (!match) throw new Error(`tokens.css has no --${name}`);
  return match[1]!.trim();
}

type Rgb = [number, number, number];
const hex = (value: string): Rgb => {
  const n = parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** `color-mix(in srgb, a p%, b)`: on the encoded values, as the browser does it. */
const mix = (a: Rgb, b: Rgb, share: number): Rgb => [0, 1, 2].map((i) => a[i]! * share + b[i]! * (1 - share)) as Rgb;
const luminance = (rgb: Rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
/** A white overlay written as `rgba(255, 255, 255, a)`, laid on a ground. */
const whiteOn = (name: string, ground: Rgb): Rgb => {
  const alpha = Number(/,\s*([\d.]+)\)$/.exec(token(name))![1]);
  return mix([255, 255, 255], ground, alpha);
};

const grounds = { ground: hex(token("ground")), surface: hex(token("surface")), "surface-2": hex(token("surface-2")) };
const inks = { ink: hex(token("ink")), "ink-2": hex(token("ink-2")), "ink-3": hex(token("ink-3")), danger: hex(token("danger")) };
const accentInk = hex(token("accent-ink"));
/** How much of the accent `--accent-text` keeps; the rest is ink. */
const ACCENT_TEXT_SHARE = Number(/--accent-text:\s*color-mix\(in srgb, var\(--accent\) (\d+)%/.exec(css)![1]) / 100;

const palettes = [
  ...Object.keys(INSTANCE_THEMES).map((id) => resolveTheme(id)),
  // Colours a viewer could pick, the extremes first: the clamp in theme.ts is what makes them usable.
  ...["#000000", "#ffffff", "#1a0033", "#fff3c4", "#ff0000", "#00ff00", "#0000ff", "#7a7a7a", "#402000", "#003b46"].map(themeFromAccent),
];

describe("text on the grounds", () => {
  it("every ink reads at 4.5:1 on every ground", () => {
    for (const [inkName, ink] of Object.entries(inks))
      for (const [groundName, ground] of Object.entries(grounds))
        expect(contrast(ink, ground), `${inkName} on ${groundName}`).toBeGreaterThanOrEqual(4.5);
  });

  it("the edge of a control is 3:1 against the ground", () => {
    expect(contrast(whiteOn("line-control", grounds.ground), grounds.ground)).toBeGreaterThanOrEqual(3);
  });
});

describe.each(palettes.map((p) => [`${p.name} ${p.accent}`, p] as const))("the accent of %s", (_, palette) => {
  const accent = hex(palette.accent);
  const hover = hex(palette.accentHover);
  const text = mix(accent, inks.ink, ACCENT_TEXT_SHARE);

  it("carries the dark glyph of the play button, at rest and hovered", () => {
    expect(contrast(accentInk, accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(accentInk, hover)).toBeGreaterThanOrEqual(4.5);
  });

  it("reads as text on every ground, and on the tinted chip", () => {
    for (const [name, ground] of Object.entries(grounds)) expect(contrast(text, ground), name).toBeGreaterThanOrEqual(4.5);
    expect(contrast(inks.ink, mix(accent, grounds.surface, 0.16)), "ink on accent-soft").toBeGreaterThanOrEqual(4.5);
  });

  it("is found as a fill and as a focus ring, 3:1 against the ground", () => {
    expect(contrast(accent, grounds.ground)).toBeGreaterThanOrEqual(3);
  });
});

describe("text over the cover's light", () => {
  it("ink and ink-2 read at 4.5:1 over a pure white cover", () => {
    const wash = Number(token("wash"));
    const scrim = Number(token("scrim").replace("%", "")) / 100;
    // The blurred cover at `--wash` over the ground, then the ground laid back over it at `--scrim`.
    const lit = mix([255, 255, 255], grounds.ground, wash * (1 - scrim));
    expect(contrast(inks.ink, lit)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(inks["ink-2"], lit)).toBeGreaterThanOrEqual(4.5);
  });
});
