import { useEffect, useRef } from "react";
import { getDiscordSdk } from "./discord";
import { describeError } from "./useActivitySync";
import type { PlaybackState } from "./useActivitySync";

/**
 * Mirrors the shared playback state onto each participant's own Discord profile.
 *
 * Discord already shows the app's icon for anyone inside an Activity without any call at
 * all — this only adds the detail lines ("Listening to <track>"), which is what
 * `rpc.activities.write` buys. It is driven by the same pushed state the UI renders, so a
 * skip updates every participant's presence rather than leaving stale text behind.
 *
 * `type: 2` is Discord's "Listening" activity type, which renders as "Listening to" rather
 * than "Playing".
 */
export function useRichPresence(state: PlaybackState | null, ready: boolean) {
  const track = state?.connected ? state.track : null;
  const paused = state?.paused ?? false;

  const title = track?.title ?? null;
  const author = track?.author ?? null;
  const lengthMs = track?.lengthMs ?? null;
  const uri = track?.uri ?? null;

  // Position is read at send time rather than depended on. Every broadcast carries a fresh
  // sample, so including it in the dependency list would re-send the presence on each one —
  // and queue mutations broadcast too, so that is a lot of pointless RPC traffic for text
  // that has not changed.
  const timing = useRef({ positionMs: 0, sampledAt: 0 });
  // In an effect, not the render body (React may render without committing). Declared before the
  // presence effect below, and effects run in order, so that one always sees the current sample.
  useEffect(() => {
    timing.current = { positionMs: state?.positionMs ?? 0, sampledAt: state?.sampledAt ?? 0 };
  });

  useEffect(() => {
    // Nothing is authenticated yet the moment this component first mounts — ready flips
    // true only after useActivitySync's authenticate() call resolves. Calling setActivity
    // before that point fails with "Not authenticated or invalid scope" (RPC code 4006),
    // which is a genuine rejection, not a state to clear presence over.
    if (!ready) return;

    if (!title) {
      // Clearing is best-effort: a user may have declined the scope, and a failed presence
      // update must never take down the player UI.
      getDiscordSdk().commands
        .setActivity({ activity: null })
        .catch((error: unknown) =>
          console.warn(`[vibe] presence clear failed: ${describeError(error)}`, error)
        );
      return;
    }

    const activity: Record<string, unknown> = {
      type: 2,
      details: title.slice(0, 128),
      state: (author ?? "Vibe").slice(0, 128),
    };

    // Timestamps make Discord render its own live countdown. Only meaningful while actually
    // playing — a paused track would otherwise show a timer that keeps running.
    if (!paused && lengthMs) {
      const { positionMs, sampledAt } = timing.current;
      const startedAt = sampledAt - positionMs;
      activity.timestamps = { start: startedAt, end: startedAt + lengthMs };
    }

    // Logged rather than swallowed: presence failing silently is indistinguishable from
    // presence being unsupported, and the two need very different fixes.
    getDiscordSdk().commands
      .setActivity({ activity })
      .then((result) => console.info("[vibe] presence set", activity, "->", result))
      .catch((error: unknown) =>
        console.warn(`[vibe] presence set FAILED: ${describeError(error)}`, activity, error)
      );

    // Deliberately keyed on what the presence actually displays — the track and whether it
    // is paused. Re-sending on anything else is noise.
  }, [ready, uri, title, author, lengthMs, paused]);
}
