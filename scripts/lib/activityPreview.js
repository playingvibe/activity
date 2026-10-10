// Shared helpers for rendering the built Activity in headless Chrome (find a browser, serve dist, capture).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const run = promisify(execFile);

/**
 * Shared machinery for rendering the built Activity in headless Chrome.
 *
 * Extracted from `scripts/assets/record-activity-gif.js` when `scripts/assets/capture-activity-shots.js` needed the same four
 * things — find a browser, serve `activity/dist`, answer the thumbnail proxy with generated art,
 * and screenshot at an exact point in page time. Importing them from the GIF script directly was
 * not an option: it calls `main()` at module load, so importing it would record a GIF as a side
 * effect.
 *
 * Nothing here knows what it is being used for. The GIF script asks for many frames at stepped
 * virtual times; the stills script asks for one frame at a tall viewport and crops it.
 */

const ROOT = path.join(import.meta.dirname, "..", "..");
export const DIST = path.join(ROOT, "activity", "dist");

/** Every Chrome that Windows, macOS or a Linux box is likely to have. */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

/**
 * @returns {string}
 * @throws {Error} When no browser is installed — a clearer failure than Chrome's own.
 */
export function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `No Chrome or Edge found. Set CHROME_PATH, or install one.\nLooked in:\n  ${CHROME_CANDIDATES.join("\n  ")}`
    );
  }
  return found;
}

/** url -> generated PNG. Each tile is drawn once and reused across every frame that wants it. */
const ARTWORK = new Map();

/**
 * Abstract cover art, generated per track rather than fetched.
 *
 * **Not a real album cover, and that is the point.** These captures are Vibe's own promotional
 * material; putting somebody else's artwork in them is the same category of problem the premium
 * design already refuses to go near. A gradient tile reads as cover art without claiming to be
 * any particular record.
 *
 * Deterministic in the requested URL, so the same track gets the same tile every run and repeat
 * captures are byte-comparable.
 * @param {string} key
 * @returns {Buffer}
 */
export function artworkFor(key) {
  const cached = ARTWORK.get(key);
  if (cached) return cached;

  const size = 640;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // A cheap stable hash of the URL, so hue selection is a pure function of the track.
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;

  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, `hsl(${hue}, 62%, 46%)`);
  base.addColorStop(1, `hsl(${(hue + 48) % 360}, 58%, 22%)`);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // An off-centre highlight, which is what stops a flat two-stop gradient reading as a colour
  // swatch rather than a cover.
  const glow = ctx.createRadialGradient(size * 0.3, size * 0.28, 0, size * 0.3, size * 0.28, size * 0.8);
  glow.addColorStop(0, "rgba(255,255,255,0.30)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  const png = canvas.toBuffer("image/png");
  ARTWORK.set(key, png);
  return png;
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

/**
 * Serves `activity/dist`. Chrome needs a real origin — the bundle is an ES module, and `file://`
 * refuses to load those.
 * @param {number} port
 * @returns {Promise<import("node:http").Server>}
 */
export function serve(port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    // Stands in for the bot's own thumbnail proxy, which is not running here. The fixture's
    // artwork URLs point at an unreachable host precisely so an ordinary preview shows the
    // player's real fallback; captures are the one context where art should appear.
    if (url.pathname === "/.proxy/api/thumbnail") {
      const tile = artworkFor(url.searchParams.get("url") ?? "");
      res.writeHead(200, { "Content-Type": "image/png" });
      return res.end(tile);
    }

    const file = url.pathname === "/" ? "/index.html" : url.pathname;
    const target = path.resolve(DIST, `.${file}`);

    if (!target.startsWith(DIST)) return res.writeHead(403).end();

    // Read before writing any header: Chrome asks for /favicon.ico, and writing a 200 and
    // *then* discovering the file is missing leaves nothing valid to send.
    let body;
    try {
      body = fs.readFileSync(target);
    } catch {
      return res.writeHead(404).end("Not found");
    }

    res.writeHead(200, { "Content-Type": TYPES[path.extname(target)] ?? "text/plain" });
    res.end(body);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolve(server));
  });
}

/**
 * One screenshot, at an exact point in page time.
 *
 * `--virtual-time-budget` is the load-bearing flag: Chrome advances the page's clock to the
 * budget and *then* screenshots, so anything driven by `Date.now()` — the progress bar, above
 * all — lands on a reproducible offset instead of wherever real time happened to be.
 *
 * Captured at `--force-device-scale-factor=2` and downscaled by the caller, which is what keeps
 * the type crisp; rendering at 1x gives visibly softer letterforms at these sizes.
 * @param {object} options
 * @param {string} options.chrome
 * @param {string} options.profileDir - A fresh profile per run, so a previous capture's storage
 *        cannot change what renders.
 * @param {string} options.url
 * @param {number} options.width
 * @param {number} options.height
 * @param {number} options.budgetMs
 * @param {string} options.outFile
 * @returns {Promise<void>}
 */
export async function capture({ chrome, profileDir, url, width, height, budgetMs, outFile }) {
  await run(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      // Deterministic rendering: without these, font hinting and the device pixel ratio can
      // differ between runs and repeat captures stop matching.
      "--force-device-scale-factor=2",
      "--force-color-profile=srgb",
      "--disable-lcd-text",
      `--window-size=${width},${height}`,
      `--virtual-time-budget=${budgetMs}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      `--screenshot=${outFile}`,
      url,
    ],
    { timeout: 60_000, windowsHide: true }
  );
}

/** Side of one comparison block, in pixels of the 1x image. */
const BLOCK = 16;
/** Channel difference, 0..255, from the usual block that marks a frame as caught mid-load. */
const BLOCK_LIMIT = 36;
/** The bottom of the frame holds the progress bar, the clock and the controls, which change from frame to frame by design. */
const MOVING_SHARE = 0.18;

/**
 * Per-block average colour of a frame, over the part of it that holds still.
 * @param {string} file
 * @returns {Promise<number[][]>}
 */
async function blocksOf(file) {
  const img = await loadImage(file);
  const cols = Math.floor(img.width / 2 / BLOCK);
  const rows = Math.floor((img.height / 2) * (1 - MOVING_SHARE) / BLOCK);
  const small = createCanvas(cols, rows);
  const ctx = small.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, cols * BLOCK * 2, rows * BLOCK * 2, 0, 0, cols, rows);
  const { data } = ctx.getImageData(0, 0, cols, rows);
  const out = [];
  for (let i = 0; i < data.length; i += 4) out.push([data[i], data[i + 1], data[i + 2]]);
  return out;
}

/**
 * Finds the frames that were screenshotted before the page had finished drawing (a queue thumbnail still empty, the
 * artwork not there yet) and captures them again.
 *
 * Chrome occasionally takes the picture a moment early even at an exact page time, and in a loop one such frame shows as a
 * black flash. Everything above the controls is meant to be identical in every frame, so a frame is broken when a block of
 * it is far from the same block's median across the whole recording.
 * @param {string[]} files - The frames, in order.
 * @param {(index: number) => Promise<void>} recapture - Writes frame `index` again, to the same file.
 * @param {number} [attempts]
 * @returns {Promise<number>} How many frames had to be taken again.
 */
export async function repairFrames(files, recapture, attempts = 4) {
  let redone = 0;
  for (let round = 0; round < attempts; round += 1) {
    const all = await Promise.all(files.map(blocksOf));
    const median = all[0].map((_, b) => [0, 1, 2].map((c) => all.map((frame) => frame[b][c]).sort((x, y) => x - y)[all.length >> 1]));
    const broken = all
      .map((frame, i) => [i, frame.some((px, b) => px.some((v, c) => Math.abs(v - median[b][c]) > BLOCK_LIMIT))])
      .filter(([, bad]) => bad)
      .map(([i]) => i);
    if (broken.length === 0) return redone;
    if (round === attempts - 1) {
      // Some moments come out the same however often they are taken again. A neighbour's picture stands in for them: the
      // content above the controls is the same in every frame, and one repeated frame is not visible in a loop.
      const bad = new Set(broken);
      for (const i of broken) {
        let from = i - 1;
        while (from >= 0 && bad.has(from)) from -= 1;
        if (from < 0) {
          from = i + 1;
          while (from < files.length && bad.has(from)) from += 1;
        }
        if (from >= 0 && from < files.length) fs.copyFileSync(files[from], files[i]);
      }
      return redone;
    }
    for (const i of broken) {
      await recapture(i);
      redone += 1;
    }
  }
  return redone;
}
