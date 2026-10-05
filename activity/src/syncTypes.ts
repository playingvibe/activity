// The shapes that cross the socket, and what the hook hands the UI. Types only: no behaviour lives here.

export type Track = {
  title: string | null;
  author: string | null;
  uri: string | null;
  thumbnail: string | null;
  lengthMs: number | null;
  isStream: boolean;
  requesterId: string | null;
  requesterName: string | null;
  /** Upcoming tracks only: how many listeners have boosted this one. Absent from an older bot. */
  boosts?: number;
};

export type PlaybackState = {
  type: "state";
  guildId: string;
  connected: boolean;
  paused?: boolean;
  voiceChannelId?: string | null;
  positionMs?: number;
  /** The server's clock when it sampled the position. Right for a presence timestamp, wrong to subtract from the viewer's clock. */
  sampledAt: number;
  /** The viewer's own clock when this frame arrived: what `positionMs` is extrapolated from. Absent in a mock. */
  receivedAt?: number;
  volume?: number | null;
  repeatMode?: "off" | "track" | "queue";
  track?: Track | null;
  /** At most the first 50 upcoming tracks. */
  queue?: Track[];
  /** The real number of upcoming tracks, which `queue` may be cut short of. */
  queueLength?: number;
  /** How many boosts make a track move to next. Absent from an older bot. */
  boostRequired?: number;
};

export type ControlAction =
  | "pause"
  | "resume"
  | "skip"
  | "previous"
  | "seek"
  | "volume"
  | "jump"
  | "shuffle"
  | "loop";

/** Server-computed hint for whether this viewer may drive playback. The server re-checks for
 * real on every control message, so this only decides whether the UI offers the buttons. */
export type Capabilities = { canControl: boolean };

/**
 * - `connecting` — no state yet. `reason` says why it is still waiting, when the server said.
 * - `ready` — the socket is live and `state` is current.
 * - `stale` — `state` is the last thing received, and it is **not live**: the socket dropped, or the
 *   server stopped the feed because this user left the voice channel. The player stays on screen,
 *   frozen, under `reason`, with its controls disabled.
 * - `error` — nothing more will happen without reopening the Activity.
 */
export type SyncStatus =
  | { phase: "connecting"; reason?: string | null }
  | { phase: "ready"; state: PlaybackState }
  | { phase: "stale"; state: PlaybackState; reason: string }
  | { phase: "error"; error: string };

/** The signed-in user, captured from authenticate()'s own response — no separate fetch. */
export type Identity = {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
};

export type ProfileStats = {
  totalListeningTime: number;
  currentStreak: number;
  longestStreak: number;
  /** Tracks credited with listening time. Absent from an older server. */
  sessionCount?: number;
};

/** Where the listener is on the level curve: `remainingMs` is null at the top level. */
export type ProfileLevel = { level: number; progress: number; remainingMs: number | null };

/** An earned badge tier: the name and its colour, as `/rank` shows them. */
export type ProfileBadge = { name: string; color: string };

/**
 * `plan` is always null today. Entitlements are mirrored onto the user (see the bot's
 * `EntitlementService`), but the profile panel does not surface premium yet.
 */
export type Profile = {
  stats: ProfileStats;
  /** `level` and `badges` are absent when the bot is older than this panel (the two deploy apart). */
  level?: ProfileLevel;
  badges?: ProfileBadge[];
  plan: null;
};

/** Sent once at connect, not with the profile — see `SocketProtocol`'s handshake in `src/presentation/http/socketProtocol.js` on why. */
export type Prefs = { accent: string | null; background: string | null };

export type GuildRole = { id: string; name: string; color: string };
export type GuildChannel = { id: string; name: string; kind: "text" | "voice" };
export type GuildConfig = {
  djRoles: string[];
  voiceChannels: string[];
  commandsChannels: string[];
  logChannelId: string | null;
  announcements: boolean;
  autoplay: boolean;
  autoplayRoomTaste: boolean;
  /** Counted, not listed: who a server has blocked is not something this panel publishes. */
  blockedUserCount: number;
  blockedRoleCount: number;
};

export type GuildContext = {
  /** **This bot's effective settings** — the server's document with this bot's overrides applied. */
  config: GuildConfig;
  /** Which of those values are this bot's own rather than the server's. */
  overridden: string[];
  roles: GuildRole[];
  channels: GuildChannel[];
};
