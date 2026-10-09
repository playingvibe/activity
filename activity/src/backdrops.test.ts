import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARD_BACKGROUND_KEYS } from "./generated/cardBackgrounds";

describe("backdrop styles", () => {
  it("has a rule for every key the generated allow-list accepts", () => {
    // The key becomes a class name (`vibe-backdrop--<key>`), so a key with no rule passes validation and
    // then renders nothing, which is exactly the failure the allow-list exists to prevent.
    const css = readFileSync(new URL("./styles/views.css", import.meta.url), "utf8");
    for (const key of CARD_BACKGROUND_KEYS) {
      expect(css, key).toMatch(new RegExp(`\\.vibe-backdrop--${key}\\b`));
    }
  });
});

describe("backdrop strength", () => {
  // The most each may show, as measured on its brightest pixel with the content hidden
  // (`.revamp/backdrop-contrast.mjs`): the level at which the quietest ink still reads at 4.5:1.
  const CEILING: Record<string, number> = { waves: 0.13, marks: 0.035, bars: 0.16, grid: 0.06, aurora: 0.3 };

  it("keeps every backdrop at or under the strength its contrast was measured at", () => {
    const css = readFileSync(new URL("./styles/views.css", import.meta.url), "utf8");
    for (const [key, ceiling] of Object.entries(CEILING)) {
      const rule = new RegExp(`\\.vibe-backdrop--${key}\\s*\\{([^}]*)\\}`).exec(css);
      expect(rule, key).not.toBeNull();
      const opacity = Number(/opacity:\s*([\d.]+)/.exec(rule![1]!)?.[1]);
      expect(opacity, key).toBeLessThanOrEqual(ceiling);
    }
  });

  it("has a ceiling for every key the allow-list accepts", () => {
    expect(Object.keys(CEILING).sort()).toEqual([...CARD_BACKGROUND_KEYS].sort());
  });
});
