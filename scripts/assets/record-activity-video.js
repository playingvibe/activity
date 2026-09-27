// Records the Activity's player as an H.264 loop for the Developer Portal's video-preview slot.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { findChrome, serve, capture } from "../lib/activityPreview.js";

const run = promisify(execFile);

/**
 * Records the Activity's player as a short H.264 loop, for the Developer Portal's Activity
 * **video preview** slot.
 *
 * **Why this exists alongside `scripts/assets/record-activity-gif.js`.** They target different slots with
 * different rules, and neither substitutes for the other. The GIF is the `/watch` preview on bot
 * lists and the website — portrait, palette-indexed, no size ceiling worth worrying about. This
 * is the Portal's video field: landscape 16:9, a hard byte budget in the hundreds of kilobytes,
 * and a real codec, which is the only reason ten seconds of full motion fits at all. The same
 * footage as a GIF is several megabytes.
 *
 * **The capture path is deliberately identical** — `activityPreview.js`'s one-Chrome-per-frame
 * virtual-time trick, the same `?mock=1` fixture, the same generated artwork. Frames land on
 * exact, reproducible page offsets, so re-running this after a layout change produces a
 * comparable video rather than a differently-timed one. Only the encoder differs.
 *
 * **Captured at 1280x720 and scaled to 640x360.** The Activity has a real wide layout — the same
 * one `scripts/assets/capture-activity-shots.js` shoots for `wide-player.png` — so this is the genuine desktop
 * player rather than the portrait one letterboxed. Capturing at 2x device scale and scaling down
 * is what keeps the type legible at 360p, where small text is the first thing to turn to mush.
 *
 * **What the ten seconds actually show.** The mock fixture is inert by design — controls are
 * no-ops and the queue never advances — so the only thing that moves is the progress bar. That is
 * why page time is stepped far faster than the video plays it: 120 frames x 1200ms sweeps the
 * fixture's 3m33s track from 1:08 to its end, which reads as a live player. Captured in real time
 * the bar would advance about 5% and the result would be indistinguishable from a still.
 *
 * Prerequisites: `cd activity && npm run build` first — this records `activity/dist`.
 *
 * Usage:
 *   node scripts/assets/record-activity-video.js
 *   node scripts/assets/record-activity-video.js --frames 60 --fps 12    a shorter loop
 *   node scripts/assets/record-activity-video.js --budget 1000           a laxer size ceiling, in KB
 *   node scripts/assets/record-activity-video.js --client <application id> --out <file>   another
 *       instance's palette (Vibe 2, Vibe 3, Beta), e.g. resource/brand/activity/vibe2-activity-preview.mp4
 */
const ROOT = path.join(import.meta.dirname, "..", "..");
const DIST = path.join(ROOT, "activity", "dist");
const OUT = path.join(ROOT, "resource", "brand", "activity", "vibe-activity-preview.mp4");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const OPTIONS = {
  port: Number(arg("port", 4323)),
  /**
   * 200 at 20fps is ten seconds, which is the ceiling this slot accepts.
   *
   * **20fps rather than 12 because the frame rate is nearly free here and the capture is not.**
   * The footage is a static dark UI with one moving element, so extra frames compress to almost
   * nothing — the first 12fps cut came out at 18 KB against a 500 KB budget. What they do cost is
   * wall time: one Chrome process per frame, about a second each. That is the real trade, and it
   * is worth roughly ninety seconds for a progress bar that glides instead of stepping.
   */
  frames: Number(arg("frames", 200)),
  fps: Number(arg("fps", 20)),
  /**
   * Milliseconds of **page** time between frames. 200 x 720 = 144s, and the fixture's track
   * starts at 1:08 of 3:33 — so the sweep ends as the bar reaches the end rather than partway
   * through, which is what makes the loop feel finished instead of cut off.
   */
  step: Number(arg("step", 720)),
  /** Capture size, scaled to `outWidth` x `outHeight` by ffmpeg. */
  width: Number(arg("width", 1280)),
  height: Number(arg("height", 720)),
  outWidth: Number(arg("out-width", 640)),
  outHeight: Number(arg("out-height", 360)),
  /** Page time burned before the first frame: mount, fonts, artwork. */
  settle: Number(arg("settle", 1600)),
  /** Hard ceiling in KB. The upload is rejected above this, so it is not advisory. */
  budgetKb: Number(arg("budget", 500)),
  out: arg("out", OUT),
  /** An application id whose palette to record (`?client=` in the mock); default is the flagship's. */
  client: arg("client", null),
};

/**
 * Constant-quality ladder, tried in order until one fits the budget.
 *
 * Deliberately CRF rather than a two-pass target bitrate. The footage is a near-static dark UI
 * with one moving element, so its natural size at good quality sits well under the ceiling — a
 * bitrate target would spend the whole budget regardless and bank nothing. The ladder takes the
 * best quality that fits and stops.
 *
 * **It starts at 16, which is close to visually lossless, because the budget is not the binding
 * constraint here.** A first pass topping out at 24 produced 18 KB of a possible 500, which is
 * not thrift — it is leaving quality on the table on a clip whose entire job is to make small
 * type and a gradient look good at 360p. The higher rungs exist for a future capture with real
 * motion in it, not for this one.
 */
const CRF_LADDER = [16, 20, 24, 28, 32, 36, 40];

/**
 * @param {string} pattern - printf-style path to the PNG sequence.
 * @param {number} crf
 * @param {string} outFile
 * @returns {Promise<number>} Bytes written.
 */
async function encode(pattern, crf, outFile) {
  await run(
    ffmpegPath,
    [
      "-y",
      "-framerate",
      String(OPTIONS.fps),
      "-i",
      pattern,
      // Lanczos rather than the default bicubic: this is a 4x reduction (2x device scale on top
      // of 1280 -> 640), and bicubic visibly softens the queue's small type at 360p.
      "-vf",
      `scale=${OPTIONS.outWidth}:${OPTIONS.outHeight}:flags=lanczos`,
      "-c:v",
      "libx264",
      "-preset",
      "veryslow",
      "-crf",
      String(crf),
      // yuv420p and High profile: anything else is what makes a file play everywhere except the
      // one browser the reviewer happens to be using.
      "-profile:v",
      "high",
      "-pix_fmt",
      "yuv420p",
      // The slot loops the clip, so every playthrough starts at frame 0 — one keyframe there and
      // nowhere else is both smaller and enough.
      "-g",
      String(OPTIONS.frames),
      "-movflags",
      "+faststart",
      "-an",
      outFile,
    ],
    { timeout: 600_000, windowsHide: true }
  );
  return fs.statSync(outFile).size;
}

async function main() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    throw new Error(`No build at ${path.relative(ROOT, DIST)}. Run: cd activity && npm run build`);
  }
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static resolved no binary. Run: npm rebuild ffmpeg-static");
  }

  const server = await serve(OPTIONS.port);
  const url = `http://localhost:${OPTIONS.port}/?mock=1${OPTIONS.client ? `&client=${OPTIONS.client}` : ""}`;
  const chrome = findChrome();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-video-"));

  const pageSeconds = ((OPTIONS.frames * OPTIONS.step) / 1000).toFixed(0);
  const playSeconds = (OPTIONS.frames / OPTIONS.fps).toFixed(1);
  console.log(`Chrome:  ${chrome}`);
  console.log(`ffmpeg:  ${ffmpegPath}`);
  console.log(
    `Capture: ${OPTIONS.frames} frames at ${OPTIONS.width}x${OPTIONS.height} -> ` +
      `${OPTIONS.outWidth}x${OPTIONS.outHeight} — ${pageSeconds}s of playback in ${playSeconds}s`
  );

  try {
    for (let i = 0; i < OPTIONS.frames; i += 1) {
      const file = path.join(work, `frame-${String(i).padStart(4, "0")}.png`);
      await capture({
        chrome,
        profileDir: path.join(work, `profile-${i}`),
        url,
        width: OPTIONS.width,
        height: OPTIONS.height,
        budgetMs: OPTIONS.settle + i * OPTIONS.step,
        outFile: file,
      });
      if (!fs.existsSync(file)) throw new Error(`Chrome produced no frame ${i}`);
      process.stdout.write(`\r  frame ${i + 1}/${OPTIONS.frames}`);
    }
    process.stdout.write("\n");

    fs.mkdirSync(path.dirname(OPTIONS.out), { recursive: true });
    const pattern = path.join(work, "frame-%04d.png");
    const ceiling = OPTIONS.budgetKb * 1024;

    let size = 0;
    let used = null;
    for (const crf of CRF_LADDER) {
      size = await encode(pattern, crf, OPTIONS.out);
      console.log(`  crf ${crf}: ${(size / 1024).toFixed(0)} KB`);
      if (size <= ceiling) {
        used = crf;
        break;
      }
    }
    if (used === null) {
      throw new Error(
        `Could not fit ${OPTIONS.budgetKb} KB even at crf ${CRF_LADDER.at(-1)} ` +
          `(${(size / 1024).toFixed(0)} KB). Lower --fps or --frames rather than pushing crf higher.`
      );
    }

    console.log(
      `\nWrote ${path.relative(ROOT, OPTIONS.out)} — ` +
        `${(size / 1024).toFixed(0)} KB at crf ${used}, ${playSeconds}s, ${OPTIONS.fps}fps`
    );
  } finally {
    server.close();
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exitCode = 1;
});
