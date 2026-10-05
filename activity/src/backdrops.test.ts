import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARD_BACKGROUND_KEYS } from "./generated/cardBackgrounds";

describe("backdrop styles", () => {
  it("has a rule for every key the generated allow-list accepts", () => {
    // The key becomes a class name (`vibe-backdrop--<key>`), so a key with no rule passes validation and
    // then renders nothing, which is exactly the failure the allow-list exists to prevent.
    const css = readFileSync(new URL("./player.css", import.meta.url), "utf8");
    for (const key of CARD_BACKGROUND_KEYS) {
      expect(css, key).toMatch(new RegExp(`\\.vibe-backdrop--${key}\\b`));
    }
  });
});
