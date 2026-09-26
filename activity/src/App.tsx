import { Suspense, lazy } from "react";
import Player from "./Player";

// Loaded on demand: a real session never fetches the fixture.
const MockApp = lazy(() => import("./MockApp"));

/**
 * One opt-in query-param mode, which no real user ever reaches.
 *
 * `?mock=1` renders the real player against a static fixture instead of a live connection, so
 * the UI can be looked at and iterated on in a plain browser — outside Discord the app never
 * gets past its loading state, because the SDK handshake cannot complete. It is also what
 * `scripts/assets/record-activity-gif.js` records.
 *
 * There is no mode for embedding a third-party player: Discord's CSP is applied to proxied
 * third-party HTML, orphaning that page's own script nonces, so it cannot work inside an Activity.
 */
export default function App() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("mock")) {
    return (
      <Suspense fallback={null}>
        <MockApp params={params} />
      </Suspense>
    );
  }
  return <Player />;
}
