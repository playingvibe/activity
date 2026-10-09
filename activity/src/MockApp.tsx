import { useEffect, useState } from "react";
import { applyLayoutMode } from "./layoutMode";
import Player from "./Player";
import { MOCK_SYNC } from "./mockSync";
import {
  LOST_CONNECTION_TEXT,
  RECONNECTING_TEXT,
  errorText,
  type ActivitySync,
  type PlaybackState,
} from "./useActivitySync";

/**
 * The `?mock=1` player: the real one against a static fixture. Its own module, loaded on demand
 * by `App`, so the fixture is not in the bundle a real session downloads.
 */
export default function MockApp({ params }: { params: URLSearchParams }) {
  const step = useCycle(Number(params.get("cycle")));
  const layout = params.get("layout");
  useEffect(() => {
    applyLayoutMode(layout === "focused" ? "focused" : layout === "pip" || layout === "grid" ? layout : null);
  }, [layout]);
  const sync = mockSync(params, step);
  // `&background=bars` (or waves, marks, grid, aurora) and `&accent=<hex without #>` preview what a
  // premium user chose, which the fixture's null prefs never show. Honoured only here, like `?view=`:
  // a real session takes its prefs from the server.
  const background = params.get("background");
  const accent = params.get("accent");
  const prefs = background || accent ? { accent: accent ? `#${accent}` : null, background } : sync.prefs;
  return <Player sync={{ ...sync, prefs }} />;
}

/** Counts up every `ms`, so `&cycle=4000` changes the song the way a real queue does. 0 stays still. */
function useCycle(ms: number): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!(ms > 0)) return;
    const id = setInterval(() => setStep((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return step;
}

const LONG_TITLE =
  "An Unreasonably Long Song Title That Keeps Going (Extended Anniversary Remaster) [Live at the Old Harbour Hall, Second Night]";

/**
 * The fixture, optionally in a state a static fixture never reaches on its own:
 *
 * - `&phase=connecting` — the first moments.
 * - `&phase=waiting` — refused because the viewer is not in the voice channel, retrying.
 * - `&phase=stale` — the player frozen after the connection dropped, controls disabled.
 * - `&phase=error` — reconnecting gave up.
 * - `&idle=1` — connected, nothing playing.
 * - `&paused=1`, `&loop=track|queue`, `&stream=1` — the transport's other states.
 * - `&control=0` — a listener without DJ rights: every control but skip is disabled.
 * - `&queue=0` — nothing queued. `&queueLength=N` — a queue longer than the 50 tracks the server sends.
 * - `&title=long`, `&art=0` — a title that has to be cut, and a track with no artwork.
 * - `&notice=<text>` — a refused control's message.
 * - `&cycle=<ms>` — the song changes on a timer.
 * - `&layout=pip|grid|focused` — what Discord's layout event would say (`layoutMode.ts`).
 * - `&background=bars`, `&accent=<hex>` — a premium backdrop and colour.
 * - `&client=<application id>` — the palette that instance would have (see `resolveClientId`).
 */
function mockSync(params: URLSearchParams, step: number): ActivitySync {
  const base = MOCK_SYNC.status.phase === "ready" ? MOCK_SYNC.status.state : null;
  const state = base ? shaped(base, params, step) : null;
  const sync: ActivitySync = {
    ...MOCK_SYNC,
    notice: params.get("notice"),
    capabilities: { canControl: params.get("control") !== "0" },
  };

  switch (params.get("phase")) {
    case "connecting":
      return { ...sync, status: { phase: "connecting" } };
    case "waiting":
      return { ...sync, status: { phase: "connecting", reason: errorText("not_in_voice_channel") } };
    case "stale":
      return state ? { ...sync, status: { phase: "stale", state, reason: RECONNECTING_TEXT } } : sync;
    case "error":
      return { ...sync, status: { phase: "error", error: LOST_CONNECTION_TEXT } };
    default:
      return state ? { ...sync, status: { phase: "ready", state } } : sync;
  }
}

function shaped(base: PlaybackState, params: URLSearchParams, step: number): PlaybackState {
  if (params.get("idle")) return { ...base, track: null, queue: [], queueLength: 0 };

  // The whole list rotates, so each step is what a skip does: the next song plays and leaves the queue's top.
  const all = [base.track!, ...(base.queue ?? [])];
  const turn = step % all.length;
  const rotated = [...all.slice(turn), ...all.slice(0, turn)];
  let track = rotated[0]!;
  let queue = rotated.slice(1);

  if (params.get("title") === "long") track = { ...track, title: LONG_TITLE, author: "The Very Long Named Orchestra of Somewhere" };
  if (params.get("art") === "0") track = { ...track, thumbnail: null };
  if (params.get("stream")) track = { ...track, isStream: true, lengthMs: null };
  if (params.get("queue") === "0") queue = [];

  const loop = params.get("loop");
  const queueLength = Number(params.get("queueLength"));
  return {
    ...base,
    track,
    queue,
    paused: Boolean(params.get("paused")),
    repeatMode: loop === "track" || loop === "queue" ? loop : "off",
    sampledAt: base.sampledAt + step,
    ...(queueLength > 0 ? { queueLength } : { queueLength: queue.length }),
  };
}
