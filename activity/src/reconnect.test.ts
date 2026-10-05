import { describe, expect, it } from "vitest";
import { describeError, errorText, reconnectDelay } from "./useActivitySync";

describe("reconnectDelay", () => {
  it("doubles from the first try, until it reaches its ceiling", () => {
    const at = (attempt: number) => reconnectDelay(attempt, () => 0.5); // 0.5 + 0.5 = 1.0: no jitter
    expect(at(1)).toBe(at(0) * 2);
    expect(at(2)).toBe(at(0) * 4);
    const ceiling = at(60);
    expect(ceiling).toBeGreaterThan(at(0));
    expect(at(61)).toBe(ceiling);
  });

  it("spreads clients that dropped together between half and one and a half of the delay", () => {
    const steady = reconnectDelay(3, () => 0.5);
    expect(reconnectDelay(3, () => 0)).toBe(Math.round(steady * 0.5));
    expect(reconnectDelay(3, () => 0.999)).toBeLessThanOrEqual(Math.round(steady * 1.5));
    expect(reconnectDelay(3, () => 0.999)).toBeGreaterThan(steady);
  });

  it("never returns a negative or non-integer delay", () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const delay = reconnectDelay(attempt);
      expect(delay).toBeGreaterThan(0);
      expect(Number.isInteger(delay)).toBe(true);
    }
  });
});

describe("describeError", () => {
  it("reads an Error, a string and the SDK's plain RPC payloads", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
    expect(describeError("plain")).toBe("plain");
    expect(describeError({ code: 4006, message: "Not authenticated" })).toBe("Not authenticated · 4006");
  });

  it("never collapses an object to [object Object]", () => {
    expect(describeError({})).toBe("{}");
    expect(describeError({ nested: { a: 1 } })).toContain("nested");
  });
});

describe("errorText", () => {
  it("has user-facing words for every code the server can send, never the code itself", () => {
    for (const code of [
      "blocked",
      "discord_unavailable",
      "not_dj",
      "queue_changed",
      "rate_limited",
      "not_in_voice_channel",
      "invalid_token",
      "nothing_playing",
    ]) {
      const text = errorText(code);
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toContain("_");
    }
  });

  it("answers an unknown code with something generic rather than the code", () => {
    const text = errorText("a_code_from_a_newer_server");
    expect(text).not.toContain("a_code_from_a_newer_server");
  });
});

describe("waitingRetryDelay", () => {
  it("is spread between half and one and a half of the flat wait, so waiting clients do not return together", async () => {
    const { waitingRetryDelay } = await import("./useActivitySync");
    const steady = waitingRetryDelay(() => 0.5);
    expect(waitingRetryDelay(() => 0)).toBe(Math.round(steady * 0.5));
    expect(waitingRetryDelay(() => 0.999)).toBeLessThanOrEqual(Math.round(steady * 1.5));
    expect(waitingRetryDelay(() => 0.999)).toBeGreaterThan(steady);
  });
});

describe("projectPosition", () => {
  const track = { lengthMs: 200_000 } as never;
  const frame = (over: object) =>
    ({ type: "state", guildId: "g", connected: true, positionMs: 60_000, sampledAt: 1_000_000, track, ...over }) as never;

  it("runs from when this machine received the frame, whatever the server's clock said", async () => {
    const { projectPosition } = await import("./useActivitySync");
    // The viewer's clock is 20 s behind the server's: sampledAt is far ahead of anything the viewer reads.
    const state = frame({ sampledAt: 1_000_000, receivedAt: 980_000 });
    expect(projectPosition(state, 985_000)).toBe(65_000);
    expect(projectPosition(state, 990_000)).toBe(70_000);
  });

  it("without a receivedAt (a mock) falls back to the server's clock", async () => {
    const { projectPosition } = await import("./useActivitySync");
    expect(projectPosition(frame({}), 1_004_000)).toBe(64_000);
  });

  it("stops at the end of the track, holds when paused or not live, and is 0 when nothing is connected", async () => {
    const { projectPosition } = await import("./useActivitySync");
    const state = frame({ receivedAt: 1_000_000 });
    expect(projectPosition(state, 1_900_000)).toBe(200_000);
    expect(projectPosition(frame({ receivedAt: 1_000_000, paused: true }), 1_050_000)).toBe(60_000);
    expect(projectPosition(state, 1_050_000, false)).toBe(60_000);
    expect(projectPosition(frame({ connected: false }), 1_050_000)).toBe(0);
    expect(projectPosition(null, 1_050_000)).toBe(0);
  });
});
