/**
 * Which minimised layout a phone's window gets, if it is a minimised one.
 *
 * Measured on a phone (screen 390 x 844): Discord's minimised Activity is a *portrait* window that keeps
 * one shape (about 0.53 wide to tall) however it is zoomed, from roughly 90 x 170 up to 340 x 641. It is
 * never as wide as the screen, which is what tells it from the full-screen Activity: the full one is
 * exactly the screen's width. So a window is minimised if it is a portrait window on a phone that is
 * clearly narrower than the screen, and the layout is chosen by its width:
 *
 * - `"tiny"`: too small to read anything, so the artwork is the window.
 * - `"stack"`: the artwork over the title, the artist and a progress bar.
 *
 * **The visible window is a square, though the page is not.** The page is that tall portrait shape, but
 * Discord shows only a square the width of the page, from about its middle; everything above and below is
 * cut off. So a layout has to fit in that `--mini-side` x `--mini-side` square, which starts `--mini-top`
 * down (both set here, in pixels), rather than in the page: a bar pinned to the page's bottom, or text
 * centred in its height, would not be seen.
 *
 * `null` is any other window: a desktop one, the full-screen phone Activity, or a phone held sideways.
 * Stamped on `<html>` as `data-mini`, which `player.css` keys off.
 */

/** Narrower than this, and a title would not be readable beside any picture. */
const TINY_BELOW = 170;
/**
 * How far above the exact middle the visible square begins, as a share of its side. Tuned by eye on a
 * phone: the exact centre sits slightly low. Change it here if a device shows a gap above or below.
 */
const NUDGE_UP = 0.05;

/** The full-screen Activity is the screen's width; the minimised one is clearly less. */
const FULL_WIDTH_FRACTION = 0.92;

export type MiniWindow = "tiny" | "stack" | null;

export function classifyMiniWindow(input: {
  platform: "mobile" | "desktop";
  width: number;
  height: number;
  screenWidth: number;
}): MiniWindow {
  if (input.platform !== "mobile") return null;
  if (input.height <= input.width) return null;
  if (input.width >= input.screenWidth * FULL_WIDTH_FRACTION) return null;
  return input.width < TINY_BELOW ? "tiny" : "stack";
}

/** Keeps `<html data-mini>` in step with the window, which can be zoomed while it is open. */
export function watchMiniWindow(platform: "mobile" | "desktop"): void {
  const apply = () => {
    const mini = classifyMiniWindow({
      platform,
      width: window.innerWidth,
      height: window.innerHeight,
      screenWidth: window.screen.width,
    });
    if (mini) {
      document.documentElement.dataset.mini = mini;
      const side = Math.min(window.innerWidth, window.innerHeight);
      document.documentElement.style.setProperty("--mini-side", `${side}px`);
      document.documentElement.style.setProperty("--mini-top", `${Math.max(0, (window.innerHeight - side) / 2 - NUDGE_UP * side)}px`);
    } else {
      delete document.documentElement.dataset.mini;
      document.documentElement.style.removeProperty("--mini-side");
      document.documentElement.style.removeProperty("--mini-top");
    }
  };
  apply();
  window.addEventListener("resize", apply);
}
