import { useEffect, useSyncExternalStore } from "react";
import { getDiscordSdk } from "./discord";
import { isMinimised, watchLayoutMode } from "./layoutMode";

/**
 * Whether the window is a minimised one right now, from the marks the two watchers stamp on `<html>`
 * (`data-glance`, `data-mini`). Follows them as they change: the phone's window is resized while it is open.
 */
export function useMinimised(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-glance", "data-mini"] });
      return () => observer.disconnect();
    },
    () => isMinimised(),
    () => false
  );
}

/**
 * Keeps `<html data-layout>` in step with Discord's layout (focused, picture-in-picture, grid).
 * Off in the `?mock=1` preview, which has no SDK to ask; the mock takes `&layout=` instead.
 */
export function useLayoutMode(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    try {
      return watchLayoutMode(getDiscordSdk());
    } catch {
      // No client id to build the SDK from: nothing to follow.
      return undefined;
    }
  }, [enabled]);
}
