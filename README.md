# Vibe: Activity

The live player of [Vibe](https://playvibe.gg), a Discord music bot. Run `/watch` in a voice channel
and this app opens inside Discord as an [Activity](https://discord.com/developers/docs/activities/overview):
artwork, a seek bar you can drag and the whole queue, in sync for everyone in the channel.

React and Vite, no other framework. Bugs, ideas and pull requests are welcome, especially fixes to how
it looks and new backgrounds. The bot itself is not public; this repository is the part of the project
that is.

## Run it locally, with no Discord

You need Node 22 or newer.

```bash
npm run setup
npm run dev
```

Open <http://localhost:5173/?mock=1>. Mock mode plays a fixed queue from `activity/src/mockSync.ts`, so
nothing else is needed: no Discord application, no bot, no secrets.

| Add to the address | What you get |
|---|---|
| `&background=bars` | A background: `waves`, `marks`, `bars`, `grid` or `aurora` |
| `&phase=connecting` | The states the player passes through (`connecting`, `stale`, `error`, and so on) |
| `&queueLength=300` | A long queue, to check the list and its heading |
| `&client=<application id>` | The palette one instance would have (the ids and their colours are in `activity/src/generated/instances.ts`) |

**Every background at once:** <http://localhost:5173/dev/backgrounds.html> shows each one on a phone-sized
and a wide frame. It is served by the dev server only and is not part of the build.

## Checks

```bash
npm run lint
npm run build      # type-checks, then builds
```

CI runs both on every pull request, with no access to any secret.

## Screenshots, GIF and video

The images used on the website and in listings are rendered from the built Activity in headless Chrome.
You need Chrome installed.

```bash
npm run build
node scripts/assets/capture-activity-shots.js --out out     # still screenshots
node scripts/assets/record-activity-gif.js --out out/vibe-activity.gif
```

Use this to check a visual change at the sizes people actually see. The scripts read
`activity/dist` and `activity/src/mockSync.ts`.

## What is where

```
activity/src/                 the app
  player.css                  every style, and the backgrounds (.vibe-backdrop--*)
  useActivitySync.ts          the WebSocket client and its types
  mockSync.ts                 the fixtures behind ?mock=1
  generated/                  GENERATED, see below
activity/dev/                 development-only pages (backgrounds.html)
scripts/                      the render scripts
docs/architecture.md          how the pieces fit
```

## Generated files: please don't edit them

`activity/src/generated/*` is written from the bot's code (the instance list and the background styles),
which is not in this repository. It is committed as output so the app runs on its own. If your change needs
a different value there, for example a new background key, describe it in the pull request and the
maintainers will change it at the source. Comments that mention the bot refer to that private code.

## How changes flow

The maintainers' private repository is the source of truth and this one is a mirror of the Activity part of
it. A merged pull request here is re-applied there by a maintainer, and the next publish carries it back,
so the history you see here may be rewritten when that happens. Nothing you send is lost by it.

## Licence

The code is [MIT](LICENSE). That covers everything except:

- **The Vibe name and logo,** which are the project's brand and are not licensed for use as another
  bot's or service's identity.
- **Outfit** (`activity/src/fonts/`), by The Outfit Project Authors, under the SIL Open Font License 1.1
  ([`activity/src/fonts/OFL.txt`](activity/src/fonts/OFL.txt)).

Related: [playingvibe/rank-card](https://github.com/playingvibe/rank-card),
[playingvibe/brand](https://github.com/playingvibe/brand),
[playingvibe/website](https://github.com/playingvibe/website).

## Security

Please report a vulnerability privately, not in an issue: see [SECURITY.md](SECURITY.md).
