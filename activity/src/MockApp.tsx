import Player from "./Player";
import { MOCK_SYNC } from "./mockSync";
import { LOST_CONNECTION_TEXT, RECONNECTING_TEXT, errorText, type ActivitySync } from "./useActivitySync";

/**
 * The `?mock=1` player: the real one against a static fixture. Its own module, loaded on demand
 * by `App`, so the fixture is not in the bundle a real session downloads.
 */
export default function MockApp({ params }: { params: URLSearchParams }) {
  const sync = mockSync(params);
  // `&background=bars` (or waves, marks, grid, aurora) previews a premium backdrop, which the fixture's
  // null prefs never show. Honoured only here, like `?view=`: a real session takes its prefs from the server.
  const background = params.get("background");
  return <Player sync={background ? { ...sync, prefs: { accent: null, background } } : sync} />;
}

/**
 * The fixture, optionally in a connection state a static fixture never reaches on its own:
 *
 * - `&phase=connecting` — the first moments.
 * - `&phase=waiting` — refused because the viewer is not in the voice channel, retrying.
 * - `&phase=stale` — the player frozen after the connection dropped, controls disabled.
 * - `&phase=error` — reconnecting gave up.
 * - `&queueLength=N` — a queue longer than the 50 tracks the server sends.
 * - `&background=bars` — one of the premium backdrops (waves, marks, bars, grid, aurora).
 */
function mockSync(params: URLSearchParams): ActivitySync {
  const base = MOCK_SYNC.status.phase === "ready" ? MOCK_SYNC.status.state : null;
  const queueLength = Number(params.get("queueLength"));
  const state = base && queueLength > 0 ? { ...base, queueLength } : base;

  switch (params.get("phase")) {
    case "connecting":
      return { ...MOCK_SYNC, status: { phase: "connecting" } };
    case "waiting":
      return { ...MOCK_SYNC, status: { phase: "connecting", reason: errorText("not_in_voice_channel") } };
    case "stale":
      return state ? { ...MOCK_SYNC, status: { phase: "stale", state, reason: RECONNECTING_TEXT } } : MOCK_SYNC;
    case "error":
      return { ...MOCK_SYNC, status: { phase: "error", error: LOST_CONNECTION_TEXT } };
    default:
      return state ? { ...MOCK_SYNC, status: { phase: "ready", state } } : MOCK_SYNC;
  }
}
