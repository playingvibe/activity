import type { ActivitySync, PlaybackState, Track } from "./useActivitySync";

/**
 * A fixture standing in for a live sync connection, used only by App.tsx's `?mock=1` preview.
 *
 * The Activity cannot render past its loading state outside Discord — it needs the SDK
 * handshake params that only a real Activity session provides — which makes the
 * UI impossible to look at without deploying and launching it in a
 * voice channel. This fixture removes that: `?mock=1` renders the full player against static
 * data in any browser, so layout and styling work needs no Discord, no bot, and no tunnel.
 *
 * It is deliberately not wired to anything: `send` and friends are no-ops, so controls are
 * inert. This previews appearance, not behaviour.
 *
 * The track list is chosen to be **recognisable rather than personal**: this fixture is what
 * `scripts/assets/record-activity-gif.js` records for the listing and website assets, so the names on
 * screen are seen by people deciding whether to add the bot. A track everyone knows reads as a
 * demo; someone's actual library reads as a screenshot taken by accident.
 */

let artIndex = 0;

function track(
  title: string,
  author: string,
  lengthMs: number,
  // Prop requesters, never a real handle. These names are rendered into the listing
  // screenshots `scripts/assets/capture-activity-shots.js` produces, so a real username showing up
  // under "Requested by" would read as a screenshot taken by accident.
  requesterName: string | null = "mara"
): Track {
  return {
    title,
    author,
    uri: "https://example.invalid/track",
    // An unreachable host on purpose. Thumbnails are proxied through the bot, which is not
    // running in mock mode, so in an ordinary preview this 404s and the player falls back to
    // its own placeholder — which keeps that path honest and visible.
    //
    // `scripts/assets/record-activity-gif.js` is the exception: it answers the proxy path itself with
    // a generated abstract tile, so the recorded GIF shows artwork. Generated rather than real
    // covers, deliberately — putting somebody else's album art in Vibe's own promotional
    // material is exactly the kind of thing the premium/IP constraint exists to avoid.
    thumbnail: `https://demo.vibe.invalid/art/${(artIndex += 1)}.png`,
    lengthMs,
    isStream: false,
    requesterId: "100000000000000001",
    requesterName,
  };
}

const MOCK_STATE: PlaybackState = {
  type: "state",
  guildId: "100000000000000002",
  connected: true,
  paused: false,
  voiceChannelId: "100000000000000003",
  positionMs: 68_000,
  // useLivePosition extrapolates position from this sample, so it has to be a real "now" —
  // a fixed 0 would put the sample at the epoch and peg the progress bar at the track's end.
  sampledAt: Date.now(),
  receivedAt: Date.now(),
  volume: 70,
  repeatMode: "off",
  track: track("Never Gonna Give You Up", "Rick Astley", 213_000, "mara"),
  boostRequired: 2,
  queue: [
    track("Take On Me", "a-ha", 225_000, "mara"),
    track("Africa", "TOTO", 295_000, "juno"),
    // One boost of the two it takes, so the preview shows the tally.
    { ...track("Blue Monday", "New Order", 448_000, "pip"), boosts: 1 },
    track("運命 (Unmei)", "Kaoru", 199_500, null),
    track("Midnight City", "M83", 244_000, "juno"),
    track("Cola", "Arlo Parks", 201_000, "mara"),
  ],
};

const noop = () => {};

export const MOCK_SYNC: ActivitySync = {
  status: { phase: "ready", state: MOCK_STATE },
  notice: null,
  noticeAt: 0,
  // A prop identity for the same reason as the requester names above: this is what the
  // Profile view renders, and the listing screenshots are public.
  identity: {
    id: "100000000000000001",
    username: "mara",
    globalName: "mara",
    avatarUrl: null,
  },
  // The preview shows the instance palette: a mock accent would put a colour no real instance
  // uses into every screenshot and every recorded GIF.
  prefs: null,
  profile: {
    // What the bot's own rules give for these stats (`getLevel` and `getEarnedBadgeTiers`: level 28, 30% in,
    // 10 h 48 min to go; 227 h is Gold Listener and 640 tracks is Gold Collector), and the same numbers
    // `scripts/assets/render-rank-card.js` draws, so the listing never shows two different profiles.
    stats: { totalListeningTime: 227 * 60 * 60 * 1000, currentStreak: 12, longestStreak: 31, sessionCount: 640 },
    level: { level: 28, progress: 0.3, remainingMs: 10 * 60 * 60 * 1000 + 48 * 60 * 1000 },
    badges: [
      { name: "Gold Listener", color: "#F5C542" },
      { name: "Gold Collector", color: "#F5C542" },
    ],
    plan: null,
  },
  guildContext: {
    config: {
      djRoles: ["1", "2"],
      voiceChannels: ["10"],
      commandsChannels: ["20"],
      logChannelId: null,
      announcements: true,
      autoplay: true,
      autoplayRoomTaste: true,
      blockedUserCount: 2,
      blockedRoleCount: 0,
    },
    // One badge in the mock, so the "this bot only" treatment is visible in a screenshot.
    overridden: ["voiceChannels"],
    roles: [
      { id: "1", name: "DJ", color: "#FC3659" },
      { id: "2", name: "Moderator", color: "#3DBEFA" },
      { id: "3", name: "Member", color: "#99aab5" },
    ],
    channels: [
      { id: "10", name: "music-vc", kind: "voice" },
      { id: "20", name: "commands", kind: "text" },
      { id: "21", name: "bot-logs", kind: "text" },
    ],
  },
  // Flip to false to preview the non-DJ state, where the transport is visibly disabled
  // rather than offering buttons the server will refuse.
  capabilities: { canControl: true },
  send: noop,
  boost: noop,
  jump: noop,
  requestProfile: noop,
  requestGuildContext: noop,
};
