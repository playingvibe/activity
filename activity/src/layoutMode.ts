/**
 * Which of Discord's three layouts the Activity is shown in, from the one event that says so.
 *
 * - `focused`: the Activity's own pane, the one people use. Always interactive.
 * - `pip`: the small floating window. It cannot be clicked through.
 * - `grid`: a tile in the grid of voice participants. Also small, also not for pressing.
 *
 * The size of the window cannot tell these apart: a small real pane and the picture-in-picture
 * window can be the same 560 x 315. So the read-only layout used to take away the controls of a
 * small pane that was perfectly usable. Discord reports the mode itself
 * (`ACTIVITY_LAYOUT_MODE_UPDATE`), and that is what `styles/small-windows.css` now keys off.
 *
 * Stamped on `<html>` as `data-layout`, and as `data-glance` for the two layouts that are looked at
 * and never touched. **No event means no attribute, and no attribute means the interactive layout**:
 * Discord sends the event when the mode changes, not at the start, and an Activity opened in the
 * focused pane is the normal case. The failure that costs least is a cramped but working player in a
 * window nobody can click, not a real pane that has lost its buttons.
 *
 * The phone's minimised window is a different thing (`miniWindow.ts`, sized from the page), and
 * wins over this where both apply.
 */

export type LayoutMode = "focused" | "pip" | "grid";

/** The SDK's `LayoutModeTypeObject`: -1 is "unhandled", which is not a mode. */
export function layoutModeName(code: unknown): LayoutMode | null {
  switch (code) {
    case 0:
      return "focused";
    case 1:
      return "pip";
    case 2:
      return "grid";
    default:
      return null;
  }
}

/** Only the part of the SDK this needs, so the subscription can be tested without Discord. */
export type LayoutSdk = {
  ready(): Promise<unknown>;
  subscribe(event: "ACTIVITY_LAYOUT_MODE_UPDATE", listener: (event: { layout_mode: number }) => unknown): Promise<unknown>;
  unsubscribe(event: "ACTIVITY_LAYOUT_MODE_UPDATE", listener: (event: { layout_mode: number }) => unknown): Promise<unknown>;
};

/** Whether the window is one of the small ones that are looked at: Discord's PiP or grid tile, or the phone's minimised window. */
export function isMinimised(root: HTMLElement = document.documentElement): boolean {
  return "glance" in root.dataset || "mini" in root.dataset;
}

export function applyLayoutMode(mode: LayoutMode | null, root: HTMLElement = document.documentElement): void {
  if (mode) root.dataset.layout = mode;
  else delete root.dataset.layout;
  if (mode === "pip" || mode === "grid") root.dataset.glance = "";
  else delete root.dataset.glance;
}

/**
 * Follows the layout for as long as it is running; returns what stops it. Never throws: a client that
 * does not offer the event leaves the page as it is, in the interactive layout.
 */
export function watchLayoutMode(sdk: LayoutSdk, root: HTMLElement = document.documentElement): () => void {
  let stopped = false;
  const listener = (event: { layout_mode: number }) => {
    if (!stopped) applyLayoutMode(layoutModeName(event.layout_mode), root);
  };

  sdk
    .ready()
    .then(() => (stopped ? undefined : sdk.subscribe("ACTIVITY_LAYOUT_MODE_UPDATE", listener)))
    .catch(() => {
      /* the event is not offered here: the interactive layout it is */
    });

  return () => {
    stopped = true;
    applyLayoutMode(null, root);
    sdk.unsubscribe("ACTIVITY_LAYOUT_MODE_UPDATE", listener).catch(() => {});
  };
}
