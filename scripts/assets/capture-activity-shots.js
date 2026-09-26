// Screenshots the built Activity into resource/brand/press/ for the bot-list entries.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { findChrome, serve, capture } from "../lib/activityPreview.js";

/**
 * Captures the still screenshots the bot-list entries need, from the real built Activity.
 *
 * ## Why this exists
 *
 * The top.gg listings worth copying are carried by images, not prose: MEE6 runs ~10 screenshots,
 * Jockie Music 21. Vibe had exactly one asset — `vibe-activity.gif` — and no amount of rewriting
 * the description closes that gap. This turns "take some screenshots" into a command that
 * produces the same images every time, instead of a manual session that has to be repeated
 * whenever the palette or the layout changes.
 *
 * ## Portrait, and why that is the right call for the queue
 *
 * `player.css` puts the queue behind a **900px breakpoint**:
 *
 * - **≥900px** — two columns, the queue as a `minmax(280px, 360px)` rail on the right. Scaled
 *   down to the width a listing renders at, those track titles stop being readable.
 * - **<900px** — the toggle is hidden and the queue is *stacked in the scrolling body and always
 *   present*, full width.
 *
 * So the narrow viewport is not a compromise for mobile, it is the one that shows the queue
 * legibly. It also matches the GIF's 560×760, so every asset on the page reads as one set.
 *
 * ## One render per shot, not crops of one tall capture
 *
 * Headless Chrome screenshots the viewport and cannot be scrolled from the command line, so
 * rendering once at 560x1500 and cropping windows out of it does not work on
 * this layout: `.vibe-body` fills the viewport and the transport is pinned to the bottom, so a
 * taller viewport reveals no more content — it opens a dead gap between the queue and the
 * controls, and the crop below the fold came back an empty black frame.
 *
 * Each shot therefore gets its own capture at its own height. Both are genuine renders of the
 * real UI rather than pieces of one.
 *
 * Prerequisites: `cd activity && npm run build` — this captures `activity/dist`.
 *
 * Usage:
 *   node scripts/assets/capture-activity-shots.js
 *   node scripts/assets/capture-activity-shots.js --budget 12000
 */

const ROOT = path.join(import.meta.dirname, "..", "..");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

/** Where the images go: `--out <dir>`, by default the press folder. */
const OUT = path.resolve(arg("out", path.join(ROOT, "resource", "brand", "press")));

const OPTIONS = {
  port: Number(arg("port", 4323)),
  /**
   * Page time before the capture. Long enough for fonts, artwork and the mount to settle, and
   * far enough into the track that the progress bar is visibly *somewhere* rather than pinned
   * at zero — a bar at 0% reads as "nothing is playing".
   */
  budget: Number(arg("budget", 9000)),
};

/**
 * One real render per shot, at a real viewport height — **not crops of one tall capture.**
 *
 * Rendering once at 560x1500 and cropping windows out of it fails on this
 * layout: `.vibe-body` fills the viewport and the transport is pinned to the bottom, so a tall
 * viewport does not reveal more content, it just opens a dead gap between the queue and the
 * controls. The crop below the fold came back an empty black frame.
 *
 * So each entry launches its own capture. `player` is the true 560x760 the design targets and
 * the GIF matches. `queue` is a little taller only because the six-track fixture queue plus the
 * transport does not fit in 760 — still a genuine render, just of a taller window.
 */
const SHOTS = [
  {
    name: "player.png",
    width: 560,
    height: 760,
    caption: "the player at its design size, same frame as the GIF",
  },
  {
    // Taller than `player` only because the six-track fixture queue plus the transport does not
    // fit in 760. Still a genuine render, just of a taller window.
    name: "queue.png",
    width: 560,
    height: 980,
    caption: "player and the full stacked queue, one screen",
  },
  {
    // `?view=` is honoured only under `?mock=1` (see Player.tsx). Settings and Profile are
    // otherwise reachable only by clicking, which a headless screenshot cannot do - and they
    // are the two shots that show something `queue.png` does not.
    name: "settings.png",
    width: 560,
    height: 760,
    view: "settings",
    caption: "per-server config: DJ roles, channels, announcements",
  },
  {
    // Shorter than the rest: the profile is a small centred card, and `.vibe-body--solo`
    // re-centres it at whatever height it is given, so 760 just adds empty ground.
    name: "profile.png",
    width: 560,
    height: 620,
    view: "profile",
    caption: "listening stats, streak and level",
  },

  // --- 16:9, for Discord's App Directory carousel -------------------------------------------
  //
  // Not the portrait shots letterboxed. Above `player.css`'s 900px breakpoint the Activity has a
  // genuine two-column layout - player left, queue as its own rail on the right - so a landscape
  // viewport produces a real desktop screenshot that fills the frame natively.
  //
  // It also removes a duplication: the portrait `player` and `queue` shots are near-identical,
  // because below the breakpoint the queue is simply stacked under the player. In the two-column
  // layout they are one image showing both.
  {
    name: "wide-player.png",
    width: 1280,
    height: 720,
    caption: "16:9 - player and queue rail, the desktop layout",
  },
  {
    name: "wide-settings.png",
    width: 1280,
    height: 720,
    view: "settings",
    caption: "16:9 - per-server configuration",
  },
];

/** @returns {Promise<void>} */
async function main() {
  if (!fs.existsSync(path.join(ROOT, "activity", "dist", "index.html"))) {
    throw new Error("activity/dist is missing - run `cd activity && npm run build` first.");
  }

  const chrome = findChrome();
  const server = await serve(OPTIONS.port);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-shots-"));
  fs.mkdirSync(OUT, { recursive: true });

  try {
    // `?mock=1` renders the fixture in `activity/src/mockSync.ts` - the same data the GIF
    // records. `?dev=1` is deliberately absent, which keeps the temporary theme picker out of
    // the shot (see Player.tsx's `devMode`).
    const base = `http://localhost:${OPTIONS.port}/?mock=1`;

    for (const shot of SHOTS) {
      const raw = path.join(work, `raw-${shot.name}`);
      await capture({
        chrome,
        profileDir: path.join(work, `profile-${shot.name}`),
        url: shot.view ? `${base}&view=${shot.view}` : base,
        width: shot.width,
        height: shot.height,
        budgetMs: OPTIONS.budget,
        outFile: raw,
      });

      // Downscaled from the 2x capture rather than rendered at 1x - the same trick the GIF
      // encoder uses, and the reason the type stays crisp at these sizes.
      const source = await loadImage(raw);
      const canvas = createCanvas(shot.width, shot.height);
      canvas.getContext("2d").drawImage(source, 0, 0, shot.width, shot.height);

      const buf = canvas.toBuffer("image/png");
      fs.writeFileSync(path.join(OUT, shot.name), buf);
      console.log(
        `  ${shot.name.padEnd(12)} ${shot.width}x${shot.height}  ${(buf.length / 1024).toFixed(0).padStart(4)} KB   ${shot.caption}`
      );
    }

    console.log(`
Written to ${path.relative(ROOT, OUT)}`);
  } finally {
    server.close();
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
