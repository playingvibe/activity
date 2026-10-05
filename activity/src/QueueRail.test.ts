import { describe, expect, it } from "vitest";
import { queueRowKeys } from "./QueueRail";
import type { Track } from "./useActivitySync";

const track = (uri: string | null): Track => ({ uri }) as Track;

describe("queueRowKeys", () => {
  it("keys a row by its link, so a shuffle moves rows instead of remounting them", () => {
    const before = queueRowKeys([track("a"), track("b"), track("c")]);
    const after = queueRowKeys([track("c"), track("a"), track("b")]);
    expect([...after].sort()).toEqual([...before].sort());
  });

  it("gives the same song queued twice two different keys, in a stable order", () => {
    const keys = queueRowKeys([track("a"), track("b"), track("a")]);
    expect(new Set(keys).size).toBe(3);
    expect(queueRowKeys([track("a"), track("b"), track("a")])).toEqual(keys);
  });

  it("copes with a track that has no link", () => {
    const keys = queueRowKeys([track(null), track(null)]);
    expect(new Set(keys).size).toBe(2);
  });
});
