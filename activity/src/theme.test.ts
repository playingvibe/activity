import { describe, expect, it } from "vitest";
import { resolveTheme, themeFromAccent } from "./theme";

/** What the play button prints on the accent (CONTROL_TEXT in theme.ts). */
const CONTROL_TEXT = "#0b0b0d";

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("themeFromAccent", () => {
  it("makes any accent readable under the play button's icon, whatever was picked", () => {
    for (const accent of ["#000000", "#111111", "#1a0033", "#220000", "#003300", "#000044", "#ffffff", "#ffc927", "#ff0066"]) {
      const theme = themeFromAccent(accent);
      expect(contrast(theme.accent, CONTROL_TEXT), accent).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("leaves a colour that is already readable alone", () => {
    expect(themeFromAccent("#ffd166").accent).toBe("#ffd166");
  });

  it("derives a hover that is lighter than the accent", () => {
    const theme = themeFromAccent("#6a5acd");
    expect(luminance(theme.accentHover)).toBeGreaterThan(luminance(theme.accent));
  });

  it("falls back to the instance palette, named Custom, for anything that is not a hex colour", () => {
    for (const bad of ["", "red", "#fff", "#gggggg", "rgb(0,0,0)", "#12345678"]) {
      const theme = themeFromAccent(bad);
      expect(theme.name).toBe("Custom");
      expect(theme.accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("resolveTheme", () => {
  it("falls back to a coherent palette for a client id nobody listed", () => {
    const theme = resolveTheme("0");
    expect(theme.accent).toMatch(/^#[0-9a-f]{6}$/i);
    expect(theme.accentHover).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("resolveTheme and the instance palettes", () => {
  it("every instance's accent is readable as small text and under the play button's icon", async () => {
    const { INSTANCE_THEMES } = await import("./generated/instances");
    for (const clientId of Object.keys(INSTANCE_THEMES)) {
      const theme = resolveTheme(clientId);
      expect(contrast(theme.accent, CONTROL_TEXT), `${clientId} ${theme.accent}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("leaves a palette that already reads well exactly as it was, hover included", async () => {
    const { INSTANCE_THEMES } = await import("./generated/instances");
    const readable = Object.entries(INSTANCE_THEMES).find(([, t]) => contrast(t.accent, CONTROL_TEXT) >= 4.5);
    expect(readable).toBeDefined();
    expect(resolveTheme(readable![0])).toEqual(readable![1]);
  });
});
