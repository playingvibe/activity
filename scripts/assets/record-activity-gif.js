// Records the Activity's player as an animated GIF for bot-list entries and the website hero.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
// gifenc ships CommonJS, so its exports arrive on the default rather than as named ones.
import gifenc from "gifenc";
// Serving dist, finding a browser, generating the stand-in artwork and screenshotting at an
// exact point in page time are all shared with `scripts/assets/capture-activity-shots.js`.
import { findChrome, serve, capture, repairFrames } from "../lib/activityPreview.js";

const { GIFEncoder, quantize, applyPalette } = gifenc;

/**
 * Records the Activity's player as an animated GIF, for bot-list entries and the website hero.
 *
 * The Activity is the one thing here no competitor has and the one thing that cannot be
 * described in a sentence — it has to be *seen*. Every listing wants a short loop, and this
 * makes producing one a command rather than a screen-recording session that has to be redone
 * every time the palette or the layout changes.
 *
 * **How it captures, and why this way.** There is no screen recorder in this toolchain, so
 * frames come from headless Chrome — one process per frame, each given a larger
 * `--virtual-time-budget` than the last. Virtual time is the load-bearing trick: Chrome advances
 * the page's clock to the budget and *then* screenshots, so the progress bar and every other
 * `Date.now()`-driven animation land on an exact, reproducible offset. Recording in real time
 * instead would give frames spaced by however long Chrome happened to take, which is neither
 * smooth nor repeatable.
 *
 * It renders the real built frontend against `?mock=1` — the same fixture `mockSync.ts` serves
 * for preview — so what is recorded is the actual UI, not a mock-up of it. `?dev=1` is
 * deliberately absent and no client ID is configured, which is what keeps the temporary theme
 * picker out of the recording (see `Player.tsx`'s `devMode`).
 *
 * Prerequisites: `cd activity && npm run build` first — this records `activity/dist`.
 *
 * Usage:
 *   node scripts/assets/record-activity-gif.js                 record the default loop
 *   node scripts/assets/record-activity-gif.js --serve         just serve dist, for eyeballing it
 *   node scripts/assets/record-activity-gif.js --client <id> --out <file>   another bot's palette
 *   node scripts/assets/record-activity-gif.js --frames 60 --step 2000 --delay 100
 */
const ROOT = path.join(import.meta.dirname, "..", "..");
const DIST = path.join(ROOT, "activity", "dist");
// Beside the invite images rather than loose in `brand/`: both are uploaded on the same
// Developer Portal screen, and `brand/` itself is source art (gradients, avatars), not output.
const OUT = path.join(ROOT, "resource", "brand", "activity", "vibe", "preview.gif");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

const OPTIONS = {
  port: Number(arg("port", 4322)),
  frames: Number(arg("frames", 48)),
  /**
   * Milliseconds of **page** time between frames.
   *
   * Deliberately not the same as `delay`, and the gap between them is the whole reason the GIF
   * is watchable. The only thing that moves in an untouched player is the progress bar, and a
   * track is three and a half minutes long — captured in real time, six seconds of GIF advances
   * it about 3%, which reads as a still image. Stepping page time faster than the GIF plays it
   * turns that into a visible sweep, which is what a viewer needs to understand that this is a
   * live player and not a screenshot.
   */
  step: Number(arg("step", 2000)),
  /** Milliseconds each frame is shown for. ~8fps: smooth enough, and small enough to load. */
  delay: Number(arg("delay", 120)),
  /**
   * Portrait, because that is the shape of the player: a large square of artwork with the queue
   * under it. 560 is the narrowest width at which nothing clips — the queue's durations are the
   * first thing to go.
   */
  width: Number(arg("width", 560)),
  height: Number(arg("height", 760)),
  /**
   * Page time to burn before the first frame. The app has to mount, fonts have to load, and the
   * artwork placeholder has to settle — a first frame taken at t=0 is a blank shell.
   */
  settle: Number(arg("settle", 1600)),
  /**
   * Ordered-dither amplitude, in 0..255 units. 0 disables it.
   *
   * **Defaults on for landscape and off for portrait, because that is the actual rule.** Banding
   * appears when a smooth gradient occupies enough of the frame to exhaust 256 indexed colours.
   * The portrait crop is mostly album tile and type, so it never banded and dithering only cost
   * it size - 1167 KB to 2385 KB for no visible gain, since the noise defeats LZW. The 16:9
   * capture is largely one dark ramp and bands badly without it.
   *
   * ~10 is about one quantisation step at the dark end, which is where the steps show. Higher
   * reads as visible grain; lower stops hiding them.
   */
  dither: Number(arg("dither", Number(arg("width", 560)) > Number(arg("height", 760)) ? 10 : 0)),
  out: arg("out", OUT),
  /** An application id whose palette to record (`&client=` in the mock); default is the flagship's. */
  client: arg("client", null),
};

/**
 * 8x8 Bayer threshold matrix, values 0..63 in the standard recursive order.
 *
 * Ordered dithering is what stops a smooth gradient banding once it is reduced to 256 indexed
 * colours. Adding a small position-dependent offset before the palette lookup makes neighbouring
 * pixels land on *different* palette entries, and the eye blends them back into a ramp.
 *
 * Deliberately ordered rather than error-diffused (Floyd-Steinberg): error diffusion is
 * sequential and its output shifts with any change upstream, so the same frame would not encode
 * identically twice. A Bayer matrix is a pure function of (x, y), so repeat runs stay
 * byte-comparable - the same property `spectrum()` and the virtual-time capture are built on.
 */
const BAYER8 = [
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
];

/**
 * Applies the Bayer offset in place, before the palette lookup.
 *
 * `data` is a `Uint8ClampedArray`, so writes clamp to 0..255 on their own and the edges need no
 * special case. Alpha is left alone - these frames are fully opaque, and nudging alpha would put
 * pixels either side of the transparency threshold.
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} amplitude - Roughly the quantisation step to spread across, in 0..255 units.
 * @returns {void}
 */
function dither(data, width, amplitude) {
  for (let i = 0; i < data.length; i += 4) {
    const px = (i / 4) % width;
    const py = Math.floor(i / 4 / width);
    const offset = (BAYER8[(py & 7) * 8 + (px & 7)] / 63 - 0.5) * amplitude;
    data[i] += offset;
    data[i + 1] += offset;
    data[i + 2] += offset;
  }
}

/**
 * @param {string[]} files - PNG frames, in order.
 * @returns {Promise<Buffer>}
 */
async function encode(files) {
  const gif = GIFEncoder();
  let palette = null;

  for (const [index, file] of files.entries()) {
    const img = await loadImage(file);
    const canvas = createCanvas(OPTIONS.width, OPTIONS.height);
    const ctx = canvas.getContext("2d");
    // Downscaled from the 2x capture, which is what keeps the type crisp: rendering at 1x and
    // encoding it directly gives visibly softer letterforms at this size.
    ctx.drawImage(img, 0, 0, OPTIONS.width, OPTIONS.height);

    const { data } = ctx.getImageData(0, 0, OPTIONS.width, OPTIONS.height);

    // One palette for the whole loop, built from the first frame and reused. A per-frame
    // palette re-quantises the same near-black background slightly differently each time,
    // which shows up as the background quietly pulsing.
    //
    // rgb565, not rgb444: the artwork is a large smooth gradient, and 4 bits per channel bands
    // it visibly. The finer space costs nothing here because the rest of the frame is near-black
    // and flat colour, so the 256 slots are not under pressure.
    // Built from the *clean* frame: dithering first would feed the noise into palette selection,
    // which is the opposite of what it is for.
    palette ??= quantize(data, 256, { format: "rgb565" });

    // Then dither, then look up. Without this a 16:9 capture bands visibly - the landscape frame
    // is mostly one large smooth dark gradient, so the 256 slots really are under pressure, which
    // the portrait crop's comment above assumed they were not.
    if (OPTIONS.dither > 0) dither(data, OPTIONS.width, OPTIONS.dither);

    gif.writeFrame(applyPalette(data, palette, "rgb565"), OPTIONS.width, OPTIONS.height, {
      palette: index === 0 ? palette : undefined,
      delay: OPTIONS.delay,
      repeat: 0,
    });
  }

  gif.finish();
  return Buffer.from(gif.bytes());
}

async function main() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    throw new Error(`No build at ${path.relative(ROOT, DIST)}. Run: cd activity && npm run build`);
  }

  const server = await serve(OPTIONS.port);
  const url = `http://localhost:${OPTIONS.port}/?mock=1${OPTIONS.client ? `&client=${OPTIONS.client}` : ""}`;

  if (flag("serve")) {
    console.log(`Serving ${url}\nCtrl-C to stop.`);
    return;
  }

  const chrome = findChrome();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-gif-"));
  console.log(`Chrome:  ${chrome}`);
  const pageSeconds = ((OPTIONS.frames * OPTIONS.step) / 1000).toFixed(0);
  const playSeconds = ((OPTIONS.frames * OPTIONS.delay) / 1000).toFixed(1);
  console.log(
    `Capture: ${OPTIONS.frames} frames at ${OPTIONS.width}x${OPTIONS.height} — ` +
      `${pageSeconds}s of playback shown in ${playSeconds}s`
  );

  try {
    const files = [];
    const take = async (i, tag = "") => {
      const file = path.join(work, `frame-${String(i).padStart(3, "0")}.png`);
      await capture({
        chrome,
        profileDir: path.join(work, `profile-${i}${tag}`),
        url,
        width: OPTIONS.width,
        height: OPTIONS.height,
        budgetMs: OPTIONS.settle + i * OPTIONS.step,
        outFile: file,
      });
      if (!fs.existsSync(file)) throw new Error(`Chrome produced no frame ${i}`);
      return file;
    };
    for (let i = 0; i < OPTIONS.frames; i += 1) {
      files.push(await take(i));
      process.stdout.write(`\r  frame ${i + 1}/${OPTIONS.frames}`);
    }
    process.stdout.write("\n");
    // A frame photographed before the page finished drawing flashes in the loop; take those again.
    let retake = 0;
    const redone = await repairFrames(files, (i) => take(i, `-retry${retake++}`));
    if (redone) console.log(`  retook ${redone} frame(s) caught mid-load`);

    const gif = await encode(files);
    fs.mkdirSync(path.dirname(OPTIONS.out), { recursive: true });
    fs.writeFileSync(OPTIONS.out, gif);
    console.log(`\nWrote ${path.relative(ROOT, OPTIONS.out)} — ${(gif.length / 1024).toFixed(0)} KB`);
  } finally {
    server.close();
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exitCode = 1;
});
