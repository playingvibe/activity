/**
 * Duration formatting for the Activity.
 *
 * **Deliberately a second implementation of `src/shared/format/duration.js`, not an import.**
 * `activity/` is a separate build unit with its own `package.json` and dependency tree, never
 * imported by `src/` and never importing from it — that separation is what lets the Activity
 * deploy to Vercel independently. Ten lines duplicated is the price; do not "fix" it by reaching
 * across the boundary.
 */

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
