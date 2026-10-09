import { describe, expect, it, vi } from "vitest";
import { applyLayoutMode, isMinimised, layoutModeName, watchLayoutMode, type LayoutSdk } from "./layoutMode";

const root = () => ({ dataset: {} as Record<string, string | undefined> }) as unknown as HTMLElement;

describe("layoutModeName", () => {
  it("names the three modes the SDK reports and nothing else", () => {
    expect(layoutModeName(0)).toBe("focused");
    expect(layoutModeName(1)).toBe("pip");
    expect(layoutModeName(2)).toBe("grid");
    expect(layoutModeName(-1)).toBeNull();
    expect(layoutModeName(undefined)).toBeNull();
    expect(layoutModeName("1")).toBeNull();
  });
});

describe("isMinimised", () => {
  it("is true for the looked-at layouts and the phone's minimised window, false for the focused pane", () => {
    const el = root();
    expect(isMinimised(el)).toBe(false);
    applyLayoutMode("focused", el);
    expect(isMinimised(el)).toBe(false);
    applyLayoutMode("pip", el);
    expect(isMinimised(el)).toBe(true);
    applyLayoutMode(null, el);
    el.dataset.mini = "stack";
    expect(isMinimised(el)).toBe(true);
  });
});

describe("applyLayoutMode", () => {
  it("marks the two layouts that are only looked at, and clears the marks for the others", () => {
    const el = root();
    applyLayoutMode("pip", el);
    expect(el.dataset).toMatchObject({ layout: "pip", glance: "" });
    applyLayoutMode("grid", el);
    expect(el.dataset).toMatchObject({ layout: "grid", glance: "" });
    applyLayoutMode("focused", el);
    expect(el.dataset.layout).toBe("focused");
    expect("glance" in el.dataset).toBe(false);
    applyLayoutMode(null, el);
    expect("layout" in el.dataset).toBe(false);
  });
});

describe("watchLayoutMode", () => {
  function fakeSdk() {
    let listener: ((event: { layout_mode: number }) => unknown) | undefined;
    const sdk: LayoutSdk = {
      ready: vi.fn(async () => undefined),
      subscribe: vi.fn(async (_event, fn) => {
        listener = fn;
      }),
      unsubscribe: vi.fn(async () => undefined),
    };
    return { sdk, send: (code: number) => listener?.({ layout_mode: code }) };
  }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("subscribes once the SDK is ready and follows what Discord reports", async () => {
    const { sdk, send } = fakeSdk();
    const el = root();
    watchLayoutMode(sdk, el);
    await settle();
    expect(sdk.subscribe).toHaveBeenCalledWith("ACTIVITY_LAYOUT_MODE_UPDATE", expect.any(Function));
    send(1);
    expect(el.dataset.glance).toBe("");
    send(0);
    expect("glance" in el.dataset).toBe(false);
  });

  it("puts the page back and unsubscribes when stopped", async () => {
    const { sdk, send } = fakeSdk();
    const el = root();
    const stop = watchLayoutMode(sdk, el);
    await settle();
    send(1);
    stop();
    expect("layout" in el.dataset).toBe(false);
    expect(sdk.unsubscribe).toHaveBeenCalled();
    send(2);
    expect("layout" in el.dataset).toBe(false);
  });

  it("does not subscribe at all when stopped before the SDK is ready", async () => {
    const { sdk } = fakeSdk();
    watchLayoutMode(sdk, root())();
    await settle();
    expect(sdk.subscribe).not.toHaveBeenCalled();
  });

  it("leaves the interactive layout in place when the event is not offered", async () => {
    const sdk: LayoutSdk = {
      ready: async () => undefined,
      subscribe: async () => {
        throw new Error("unknown event");
      },
      unsubscribe: async () => undefined,
    };
    const el = root();
    watchLayoutMode(sdk, el);
    await settle();
    expect("layout" in el.dataset).toBe(false);
  });
});
