import { describe, expect, it } from "vitest";
import { formatDuration } from "./format";

describe("formatDuration", () => {
  it("formats minutes and seconds, and hours once there are some", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5_000)).toBe("0:05");
    expect(formatDuration(213_000)).toBe("3:33");
    expect(formatDuration(3_723_000)).toBe("1:02:03");
  });
});
