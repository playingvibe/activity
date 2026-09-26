# Contributing

Thank you for helping. This repository is the Activity of [Vibe](https://playvibe.gg), the live player
that opens inside Discord. The bot is a separate, private project.

## Ways to help

- **Report a bug** with the bug template: what you did, what you saw, what you expected, and where you
  ran it (Discord on desktop or phone, or the mock in a browser). A screenshot helps more than a paragraph.
- **Fix how something looks or behaves.** Small fixes (spacing, contrast, a wrong state) can go straight to
  a pull request.
- **Propose or build a background** (below).
- **Suggest something** with the suggestion template. Say what problem it solves before what it looks like.

Security problems do not go in an issue: see [SECURITY.md](SECURITY.md).

## Set up

```bash
npm run setup
npm run dev        # http://localhost:5173/?mock=1, no Discord needed (see the README)
```

## Before you open a pull request

- `npm run lint` and `npm run build` pass.
- You checked it in the mock, on a phone-sized frame **and** a wide one, and with the states that matter:
  connecting, stale, error, a long queue.
- If you changed how it looks, screenshots (before and after) are attached.
- One change per pull request, with a description of what and why.

CI runs the same checks on every pull request, with no access to any secret.

## Backgrounds

A background is a style the player can show behind the controls. Each one exists **twice**: as CSS here
(`.vibe-backdrop--<key>` in `activity/src/player.css`) and as a canvas drawing in the
[rank card](https://github.com/playingvibe/rank-card), so a user's choice looks the same on both. That
means a new background is **two pull requests**, one to each repository, linked to each other.

What a good background contains:

- **A key**: lowercase, URL-safe, and it is what stores the choice (`waves`, `bars`...). The key list is generated
  from the bot's code (`activity/src/generated/cardBackgrounds.ts`); say the key you want in the pull
  request and a maintainer will add it there.
- **The drawing**, as a `.vibe-backdrop--<key>` rule (an inline SVG or gradients; no external files).
- **Restraint.** Backgrounds sit at low opacity behind a live UI. Text and controls must stay readable on
  top, and the player must not change layout because of one.
- **Both frames.** Add the key to the list in `activity/dev/backgrounds.html` and check the phone and wide
  previews.
- **Reduced motion.** Anything that animates has to stop under `prefers-reduced-motion`.

## Style

- TypeScript and React function components; match the code around your change.
- Styles live in `player.css` and follow the existing custom properties (`--vibe-accent` and friends): the
  accent changes per instance and per user, so don't hard-code the brand colour.
- A comment records a reason the code cannot show (an ordering, a Discord quirk, a trade-off). It does not
  restate the code.
- Commit messages use a short conventional prefix (`fix(activity): ...`, `feat(activity): ...`).

## Please don't edit generated files

`activity/src/generated/*` is generated from the bot's code, which is not here. Describe the change you
want in the pull request and a maintainer will make it at the source.

## What you can rely on when you contribute

- **Your work stays yours, under the repository's licence.** By opening a pull request you confirm that you
  wrote the change (or have the right to submit it), and you license it under the repository's
  [MIT licence](LICENSE).
- **Don't include anything you don't have the right to.** No copied images, fonts, icons or text from
  elsewhere, and no third-party logos or characters. If a change includes AI-generated code or art, say so
  in the pull request.
- **The Vibe name and logo aren't covered by the MIT licence** (see the README).
- **Reviews.** A maintainer reviews every pull request. Changes are re-applied to the maintainers' private
  repository, which is the source of truth, and the next publish carries them back here.

## Conduct

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
