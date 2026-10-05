import { describe, expect, it } from "vitest";
import { classifyMiniWindow } from "./miniWindow";

const phone = { platform: "mobile" as const, screenWidth: 390 };

describe("classifyMiniWindow", () => {
  it("is null on a desktop, whatever the size", () => {
    expect(classifyMiniWindow({ platform: "desktop", width: 200, height: 400, screenWidth: 1920 })).toBeNull();
  });

  it("is null for the full-screen phone Activity, which is the screen's width", () => {
    expect(classifyMiniWindow({ ...phone, width: 390, height: 780 })).toBeNull();
    expect(classifyMiniWindow({ ...phone, width: 380, height: 760 })).toBeNull();
  });

  it("is null for a phone held sideways", () => {
    expect(classifyMiniWindow({ ...phone, width: 600, height: 300 })).toBeNull();
    expect(classifyMiniWindow({ ...phone, width: 200, height: 200 })).toBeNull();
  });

  it("is tiny at the smallest measured size and stack from the threshold up to the largest", () => {
    expect(classifyMiniWindow({ ...phone, width: 90, height: 170 })).toBe("tiny");
    expect(classifyMiniWindow({ ...phone, width: 169, height: 320 })).toBe("tiny");
    expect(classifyMiniWindow({ ...phone, width: 170, height: 320 })).toBe("stack");
    expect(classifyMiniWindow({ ...phone, width: 340, height: 641 })).toBe("stack");
  });
});
