# Vibe Activity: design notes

The working document of the Activity's redesign. It records what the player looks like today, what
is wrong with it, what it is made of, and the rules the new design has to keep. Later sections
(direction, tokens, components) are added as each one is decided. The website's notes are in
`website/DESIGN.md`; the two share a vocabulary on purpose.

Status: **the player view is built on the new system. The queue, the panels, the states and the backdrops are next.**

## 1. Baseline

Measured on 9 October 2026 against the mock (`npm run dev`, then `/?mock=1`), in headless Chrome.

### What was captured

146 screenshots, kept out of the repository in `.revamp/baseline/` (ignored by git). The scripts
that take them, `.revamp/capture.mjs` and `.revamp/measure.mjs`, live there too.

| Set | Sizes | States |
|---|---|---|
| Player | 1280x720, 480x720, 640x300, 320x240, a phone at 390x844 | playing, paused, stream, repeat one, repeat all, empty queue, a queue of 300, long title, no artwork, no DJ rights, a refused control, nothing playing, connecting, waiting for the voice channel, reconnecting, error, settings, profile |
| Player | 1920x1080; 1280x720 with the queue closed | playing |
| Themes | 1280x720 and 480x720, plus settings and profile | the five instance palettes, a very light custom colour (`#fff3c4`) and a very dark one (`#1a0033`) |
| Backdrops | 1280x720 | waves, marks, bars, grid, aurora |
| Minimised phone window | 340x641, 180x340 (stack), 120x226 (tiny): the page and the square that is shown | playing, long title, no artwork |

The mock gained the states it could not show (`&paused`, `&loop`, `&stream`, `&control=0`,
`&queue=0`, `&title=long`, `&art=0`, `&idle`, `&notice`, `&accent`, `&cycle`); they are listed in
`MockApp.tsx`.

### Numbers

| | Value |
|---|---|
| JavaScript | 389.60 kB, 120.29 kB gzipped |
| CSS | 11.84 kB, 2.98 kB gzipped (`player.css` is 42.5 kB before minifying; most of it is comments) |
| Styles written in TypeScript | 281 lines in `playerStyles.ts`, plus two more objects in `Settings.tsx` and `Profile.tsx`; 95 `style=` attributes |
| Fonts | 32.29 kB and 14.81 kB, loaded by range |
| Tests | 60, in 8 files, all passing |

### A track change, measured

The mock changed song every 1.5 s for 9 s while each frame recorded where things were.

| | Wide, 1280x720 | Phone, 390x844 |
|---|---|---|
| Layout shift | 0.027 | **0.142** |
| The play button | did not move | did not move |
| The title | moved 15 px | did not move |
| The artwork | slid 4 px each time (the entrance animation) | the same |
| The queue | did not move | **moved 29 px** |
| Frame time, median / 99th / worst | 6.1 / 12.2 / 18.2 ms | 6.1 / 6.7 / 12.2 ms |

The cause of both movements is one line: "Requested by" is only drawn when the track has a
requester, so the block under the artwork changes height from song to song. A title long enough to
wrap does the same thing, and more: at 1280x720 a five-line title pushes the artwork up by 58 px.

During steady playback nothing shifts. The progress bar is written twice a second, so it moves in
visible steps and not smoothly, and two copies of it are kept up to date at once (below).

## 2. Critique

The player works, is careful about accessibility and was tuned on real devices. Its problem is the
same one the website had: every decision was made where it was needed, so it reads as a competent
default and not as one designed object. The website now looks better than the product it describes.

### Hierarchy

- The artwork is the hero and it is small: 230 px in a 1280x720 pane (3% of the area), 300 px at
  most on any screen. Half of a wide pane is empty ground around it.
- The song is shown twice on a wide pane, at full size on the stage and again at the left of the
  bar, and its progress twice: a line along the top of the bar and the seek slider under the
  buttons, both visible at once.
- The first thing read under the artwork is a pink "NOW PLAYING" label, which says what the whole
  screen already says. It is the only use of the accent on text, spent on the least useful words.
- On a phone there is no seek slider, no elapsed time and no length, only a 2 px line. The length
  of the playing song is not shown anywhere.
- The three round buttons at the top right are the brightest things on the screen after the play
  button, though they are the least used.
- The queue is a list of one-line rows at 13 px with the artist in the same line as the title;
  long titles push the artist out entirely. Nothing says who added a song.

### Type

- 16 different font sizes between 9.6 and 28.8 px, eight of them within 2 px of each other
  (11.2, 11.5, 11.8, 12, 12.5, 12.8, 13.1, 13.6). No scale.
- Two weights do everything: 400 and 700. The website uses 300, 500 and 600 from the same file.
- Emphasis is carried by opacity (nine values from 0.35 to 0.9) instead of by a few named inks, so
  the same grey is never quite the same grey.
- Five uppercase tracked labels ("NOW PLAYING", "UP NEXT", every settings heading), the device the
  website dropped.
- The smallest text is 9.6 px ("this bot only") and settings hints are 11.8 px at half strength.
- The title has no line limit; times use tabular figures, which is right.

### Spacing and layout

- No spacing scale: gaps of 0.1, 0.15, 0.2, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1,
  1.25, 1.5, 1.75 and 2.5 rem.
- One breakpoint (900 px of viewport width) decides everything, although the thing that matters is
  the size of the pane. Between 481 and 899 px the layout is the phone's, stretched.
- At 1920x1080 the stage keeps its 300 px artwork and the queue its 360 px; the rest is empty.
- A short, wide pane (640x300) drops to the read-only layout meant for Discord's picture-in-picture,
  so a small but real window loses its controls. A phone held sideways gets the same.
- On a phone, 56 px at the top is reserved for Discord's own buttons and the three round buttons
  sit under that, so the artwork starts a quarter of the way down the screen.
- Settings and Profile are centred columns of unrelated widths (900 px and 340 px).

### Colour

- The ground, the ink and the rose accent are the website's, which is right. Nothing else is
  shared: surfaces are white at 5.5, 6, 8, 8.5, 10 and 14% mixed with the accent at 9 or 13%.
- `#0b0b0d` and `#f5f2f3` are typed out 16 times across CSS and TypeScript.
- The accent is used for the play button, the progress, the label, the queue button when the queue
  is open, the repeat glyph, the boost pill, the profile avatar, the level bar and the settings
  badge. On one screen that is up to six places, so the play button is not special.
- The top of every screen carries a tint of the accent that nothing on the screen explains.
- The artwork's colour, the only colour that changes with the music, is not used at all.
- Contrast that fails today: the slider's track is 1.54:1 against the ground and the round
  buttons' edge is 1.19:1 (3:1 is asked of a control); a row in a disabled queue drops its artist
  to 2.74:1. Text otherwise passes: the weakest live text is 4.93:1.
- A viewer without DJ rights sees the buttons dimmed but the two sliders at full strength, though
  they are just as disabled.

### Density

- The transport is roomy (a 56 px play button in a bar 100 px tall) while the queue is tight
  (34 px thumbnails, 13 px text, rows 44 px apart). The second most important thing on the screen
  has the smallest type on it.
- Profile is five boxes holding one number each.

### Motion

- One entrance (`vibe-fade-in`, 220 ms, a 4 px rise) is applied to the artwork, the text block, the
  queue and both panels. It replays on the artwork at every song, which is the 4 px slide measured
  above, and the queue replays it whenever it goes from empty to not.
- The old artwork is removed and the new one fades in over the empty frame, so every change
  flashes the placeholder colour. Nothing connects one song to the next.
- Play and pause swap glyphs with no transition; the progress bar steps twice a second.
- Buttons answer a hover by fading to 85%, which reads as "disabled" more than "ready".
- Reduced motion is honoured everywhere, including the one endless animation (the mark pulsing
  while connecting).

### Two styling systems

- Layout that responds to anything is in `player.css`; everything static is in style objects in
  three TypeScript files. Three elements are split across both, and the small-window rules have to
  beat the inline styles with `!important` 40 times, selecting elements by position
  (`.vibe-transport-meta span:nth-child(2)`) because they have no class.
- Because a style object cannot say `:hover` or `:disabled`, disabled states are computed in
  JavaScript (`opacity: 0.35`), which is why the sliders were missed.
- There are no tokens: every colour, size, radius and duration is a literal.
- Radii are 4, 5, 6, 8, 12, 14 px, 50% and 999 px, chosen per element.

### Generic patterns found

Checked against a list of common template habits. Present: uppercase tracked labels over content;
one fade-and-rise entrance on everything; identical translucent cards for unrelated things
(Profile); middle dots joining unrelated facts ("Up next · 6", "Title · Artist"); a blurred
translucent bar; a tinted gradient wash as decoration; circles for every control regardless of
weight; opacity as the only way to say "less important". Absent, and to stay absent: gradient text,
glow effects, emoji as icons, an icon library, stock imagery, more than one accent.

### What to keep

- The shell: three regions of which one scrolls, the percentage height chain, the safe-area and
  Discord-chrome allowances. They were measured on devices and are documented where they are set.
- The minimised layouts and `miniWindow.ts`, which were tuned on a real phone.
- Every piece of accessibility work: live regions that are always mounted, real buttons in real
  list items, labelled sliders with spoken values, focus that moves with the view, reduced motion,
  the repeat dot (state is never colour alone).
- The interaction code in `Transport.tsx`: the held slider, the keyboard commit, the cooldown.
- Hand-drawn icons, one self-hosted family, no dependency beyond React.
- The colour clamp in `theme.ts`.

## 3. Inventory

### Components

| Component | Where | States |
|---|---|---|
| Shell, glow, backdrop | `Shell.tsx` | five backdrops; with and without a transport under them |
| Top bar | `TopBar.tsx` | queue toggle (wide only; pressed or not), settings (managers only), profile |
| Artwork | `Transport.tsx` | image, placeholder, failed image |
| Now playing text | `Transport.tsx` | playing, paused, stream, with and without artist and requester, long title |
| Transport bar | `Transport.tsx` | wide (three columns), narrow (buttons only), picture-in-picture, stack, tiny |
| Icon button | shuffle, repeat | ready, cooling down, no rights, offline, focus, hover, press |
| Round button | previous, skip | the same |
| Play button | | play, pause; the same states |
| Repeat | | off, all (dot), one (dot and "1") |
| Slider | seek, volume | resting, hover, dragging, keyboard, disabled, touch (thumb always shown) |
| Progress line | | wide, narrow, minimised; hidden for a stream |
| Queue | `QueueRail.tsx` | rail, stacked, hidden; empty; cut short ("the first 50 of 300"); disabled |
| Queue row | | ready, hover, focus, disabled; no artwork; stream |
| Boost | | none, some of the number needed, disabled; absent on the first row |
| Notice | `Shell.tsx` | empty (still in the page), a refused control, the reconnecting reason |
| Message | `Shell.tsx` | nothing playing, error |
| Connecting | `Shell.tsx` | plain, with the reason it is waiting |
| Settings | `Settings.tsx` | loading, waiting to reconnect, loaded; a row with a hint, with "this bot only" |
| Profile | `Profile.tsx` | loading, loaded; avatar or initial; level, statistics, badges or none |
| Live region | `Transport.tsx` | the song change, always mounted |

### Screens

Connecting, waiting, error, nothing playing, playing (ready or frozen), settings, profile.

### Themes

Five instance palettes (white, rose, blue, gold, green), a colour of the viewer's own, and one of
five backdrops. The accent passes through a clamp that lightens it until dark text reads on it.

## 4. Rules the design has to keep

1. **Nothing from anywhere else.** The Activity runs in Discord's frame under its security policy:
   images from this origin and Discord's CDN only, artwork only through `thumbnailSrc()`, no outside
   fonts, scripts or styles, no inline scripts. No new runtime dependency; the bundle may grow by
   10 kB gzipped at most.
2. **Behaviour does not change.** The state frame, the connection, reconnecting, permissions, the
   cooldown, and what every control sends stay as they are. The 60 tests and the contract tests
   stay green; a test changes only where what it checks is how something is drawn.
3. **Theming keeps working.** Every colour comes from a token, and every accent-coloured token
   derives from the one accent the shell sets. The instance palettes, a viewer's own colour and
   backdrop, and the clamp all behave as now, and every combination passes contrast.
4. **Every window.** The full pane, a narrow one, a short one, and the two minimised phone layouts,
   where only a square from the middle of a tall page is visible. From 320x240 to 1920x1080.
5. **WCAG 2.2 AA at least.** 4.5:1 for text, 3:1 for the edge of a control, a visible focus ring,
   everything by keyboard, reduced motion honoured, 44 px targets on phones, no state by colour
   alone. The song-change announcement and the repeat dot stay.
6. **Performance.** Nothing moves when the song changes. The progress bar moves smoothly without
   re-rendering the tree. Only transform and opacity are animated. Under 25 kB of CSS, no new image
   over 20 kB.
7. **Type.** Outfit, self-hosted and subset. A second face only with a reason, one file, display
   only.
8. **One styling system.** Classes and custom properties; inline style only for a value computed
   while running (the progress, the accent).
9. **No music service is named** in anything a user or a reader of this repository sees.

## 5. Directions

Decided at the audit: the cover may lend its colour to the screen, which `Shell.tsx` ruled out until
now, and a small but real window (a short pane, a phone held sideways) keeps its controls; only
Discord's picture-in-picture and the minimised phone window stay read-only.

Three mockups of the player view, static pages in `.revamp/directions/` (open
`/.revamp/directions/a.html` on the dev server; Skip changes the song). They use the website's
tokens, Outfit, invented songs and generated covers, and they differ in what the screen is for.

Taken from the players studied: a cover large enough to be recognised across a room; one line of
title, one of artist, nothing above them; times at the two ends of the seek bar; secondary controls
as bare glyphs beside a single filled play button; a queue row with two lines. Left behind: lyrics
and video canvases, full-bleed covers under text, heart and share clusters, and any colour pulled
from the cover with script.

| | A. Sleeve | B. Room light | C. Console |
|---|---|---|---|
| Idea | The cover at the size of a record sleeve, the words beside it like liner notes | The cover lights the room; the song and its controls are one centred column | A tool for the room: the song is a strip, the queue is the page |
| Cover | Up to 58% of the stage, about 500 px in a 1280x720 pane (230 px today) | About 320 px, centred, large radius | 112 px thumbnail |
| Controls | One strip along the bottom holds everything, including settings and profile; the seek bar is its top edge | Under the title, inside the column; no bar at all | In the strip at the top, with one seek rail across the full width |
| Queue | A rail with two-line rows | A separate raised panel; on a phone a sheet that shows the next song | A full-width list with who added each song |
| Accent and ground | Flat ground; accent on play and progress | A blurred copy of the cover behind a scrim; accent on play only, progress in white | Flat ground, one raised strip; accent on play, progress and a "playing" dot |
| Motion | The next cover slides over the last | The light changes over 0.9 s while the cover settles | The list moves up one row |
| Phone | Cover at full width, words under it, controls pinned | The same column; the queue is a peek at the bottom | Strip, then the list: five songs visible at 360x640 |
| Feels like | A record put on in a quiet room | A lit screen in a dark one | A mixing desk |
| Costs | Least. A long title is held to three lines beside the cover | A blur layer (cheap: a small copy scaled up) and a scrim that must hold contrast under any cover; the centred column is closest to today | The cover stops being the hero, against the brief; best for long sessions and small panes |

### Chosen: A with B's light

- **Layout** from A: the sleeve-sized cover with the words beside it, and one strip along the bottom
  that holds every control. On a wide pane Settings and Profile sit at the right end of that strip,
  so there is no top bar and the stage is only the song.
- **Light** from B, held to the stage and kept quiet: a blurred copy of the cover under a scrim.
  The queue and the strip stay flat.
- **From C**: its strip is the layout of a short pane, which keeps its controls, and the queue rows
  say who added each song.
- The five backdrops are re-placed for this layout with the rest of the shell: in the mockup the
  bars run behind the title.

## 6. The system

Built, and shown on one page in every state: `/?system=1` on the dev server (`&client=<id>` or
`&accent=<hex>` picks the palette). The player itself still has its old layout at this point; it is
drawn with the new tokens and components, and is rebuilt on them next.

### Files

`src/styles/`, imported once through `index.css`, in the order the rules depend on.

| File | Holds |
|---|---|
| `tokens.css` | every colour, size, radius, shadow and duration; the safe-area allowances; what derives from the accent |
| `base.css` | fonts, the reset, the height chain, focus, reduced motion, forced colours |
| `components.css` | icon button, play, slider, cover and thumbnail, queue row, boost, badge, notice, message, hint, command chip, connecting mark, meter, stat, avatar |
| `views.css` | the shell, the stage, the queue rail, the transport, the two panels, the backdrops |
| `small-windows.css` | picture-in-picture and the two minimised phone layouts |
| `system.css` | the specimen page only; loaded with it |

One styling system: `playerStyles.ts` and the style objects in `Settings.tsx` and `Profile.tsx` are
gone. Of 95 `style=` attributes, 5 are left, each a value computed while running: the accent on the
shell, a slider's fill, the two meters' progress, and a badge's own colour. `!important` went from
40 uses to 4, all in the reduced-motion rule. No colour or size is written twice.

| | Before | After |
|---|---|---|
| JavaScript, gzipped | 120.29 kB | 118.42 kB |
| CSS, gzipped | 2.98 kB | 4.74 kB |
| CSS, minified | 11.84 kB | 18.83 kB (budget 25) |
| Tests | 60 | 107 |

Two tests changed because what they checked was how something is drawn: the song-change region is
now hidden by a class (`vibe-sr`) where the test looked for an inline `clip`, and the backdrop test
reads `styles/views.css`. `tokens.test.ts` is new: it reads `tokens.css` and holds every pair below
for every palette.

### Colour

The grounds and inks are the website's, unchanged, and neutral on purpose: a pair's contrast then
holds whatever accent an instance or a viewer brings.

| Text | on ground `#0b0b0d` | on surface `#131317` | on surface-2 `#1b1b20` |
|---|---|---|---|
| ink `#f5f2f3` | 17.68 | 16.66 | 15.42 |
| ink-2 `#aba5a9` | 8.13 | 7.67 | 7.10 |
| ink-3 `#8d868b` | 5.54 | 5.22 | 4.83 |
| danger `#ff8a8a` | 8.67 | 8.17 | 7.56 |

The edge of a control (the unfilled part of a slider, the ring of a boost button) is white at 38%,
3.4:1 against the ground; it was 1.54:1.

The accent arrives on the shell as `--accent` and `--accent-hover`, after `theme.ts` has lightened it
until dark text reads on it. Four tokens derive from it and nothing else names a colour:
`--accent-text` (the accent as text or as a glyph, moved a fifth of the way to ink so it also reads
on the raised surfaces), `--accent-soft` and `--accent-line` (the command chip), `--accent-glow`.

| Palette | Accent | dark glyph on it | as a fill on ground | as text on ground | on surface | on surface-2 |
|---|---|---|---|---|---|---|
| Vibe Dev | `#FFFFFF` | 19.66 | 19.66 | 19.26 | 18.15 | 16.80 |
| Vibe | `#E05570` | 5.34 | 5.34 | 6.73 | 6.34 | 5.87 |
| Vibe 2 | `#5382be` (from `#4577B8`) | 4.97 | 4.97 | 6.64 | 6.26 | 5.79 |
| Vibe 3 | `#D9B15C` | 9.73 | 9.73 | 11.02 | 10.39 | 9.62 |
| Vibe Beta | `#559E68` | 6.07 | 6.07 | 7.68 | 7.24 | 6.70 |
| A viewer's `#fff3c4` | `#fff3c4` | 17.67 | 17.67 | 17.66 | 16.64 | 15.40 |
| A viewer's `#1a0033` | `#a64cff` | 4.77 | 4.77 | 6.17 | 5.82 | 5.39 |

The test also runs ten more colours a viewer could pick, black, white and the primaries among them.

Where the accent is used: the play button, the song's progress, repeat when it is on, a boost that
has votes, the "this bot only" badge, the command chip, the mark while connecting, the focus ring.
It left the label over the title, the queue toggle, the avatar and the volume, whose fill is ink.

Not covered by a token: a profile badge is drawn in the colour the server sends for it.

### Type

Outfit, at three weights (400, 500, 600) where there were two.

| Step | Size | Use |
|---|---|---|
| 3 | 24 px | the largest fixed size: a title on a narrow pane |
| 2 | 20 px | panel titles, a statistic |
| 1 | 17 px | a setting's value, messages, the artist under a large title |
| 0 | 15 px | body, a queue row's title |
| -1 | 13 px | supporting text, hints, a queue row's artist |
| -2 | 12 px | times; nothing is smaller |

Six sizes where there were sixteen. The title on the stage is the one fluid size, set with the
player view. Emphasis is an ink, never an opacity; opacity now means only "disabled". No uppercase
labels. Times and counts use tabular figures.

Differs from the website: the body is 15 px, not 17 px, and the scale stops at 24 px. This is a
tool in a small pane, read at a glance for hours; the website is read once.

### Space, radii, elevation, motion

- **Space**: 4, 8, 12, 16, 24, 32, 48 px. A target is 44 px.
- **Radii**: 8 px for controls and thumbnails, 12 px for the cover and surfaces, 20 px for panels,
  full for round buttons and pills. The website's set.
- **Elevation**: a hairline ring for what lies on the ground; one shadow, under the cover.
- **Motion**: 120 ms for a press, 200 ms for a view arriving, 600 ms for the light changing between
  songs. One easing, out only. A view arrives by opacity alone; nothing slides into place, and the
  rise that replayed on the cover at every song is gone. Colour does not transition, because a
  running transition keeps the old colour when the accent changes under it.
- **Breakpoint**: 900 px of pane width, where the queue becomes a rail; `Player.tsx` reads the same
  number. Sizes inside the stage use container units. The frame is the viewport here, so a media
  query and a container query on the app measure the same box; container queries are used where a
  region's own size matters.

### Components

Each is one class with its states beside it. Disabled is the `disabled` attribute and nothing else,
so a button and a slider refused for the same reason look the same; before, the buttons were dimmed
in script and the sliders were missed.

| Component | States |
|---|---|
| Icon button | quiet, strong (previous, skip), tonal (Back); hover, press, focus, disabled; on and off for a toggle, shown by a disc as well as by brightness; repeat off, all (dot), one (dot and "1") |
| Play | pause, play; hover, press, focus, disabled |
| Slider | seek and volume (ink fill); hover, focus, dragging, disabled; on touch the thumb is always shown and the hit area is 44 px |
| Cover, thumbnail | image, no artwork, failed image |
| Queue row | ready, hover, focus, disabled; long title; no artwork; stream; two lines, title over artist |
| Boost | none, some of the number needed, disabled; a 28 px pill in a 44 px target |
| Badge | accent, or a colour of its own |
| Notice | a refused control, why the player is frozen; a live region that is always mounted |
| Message, hint, command chip | nothing playing, error, loading text |
| Connecting | the mark, with or without the reason it is waiting |
| Meter | progress where there is no slider; the level; filled by scaling, never by resizing |
| Stat, avatar | the profile's figures; image or initial |

Not built, because the Activity has none and gains none: a menu or popover, and a toggle switch
(settings are read here and changed with a command). Skeletons are decided with the panels.

### Checked against the Web Interface Guidelines

Applied: `overscroll-behavior: contain` on the two scrolling regions; a balanced title;
`translate="no"` on commands; a `theme-color`; `touch-action: manipulation` and an intentional tap
highlight on controls; scaling instead of resizing for the meters. Already met: labelled icon
buttons and sliders, real buttons, hidden decorative icons, polite live regions, `:focus-visible`,
reduced motion, tabular figures, long text cut with an ellipsis, safe-area insets, `color-scheme`,
no `transition: all`, lazy thumbnails. Not followed, on purpose: Title Case (the voice is sentence
case, as on the website); width and height attributes on images (every image sits in a box whose
size the stylesheet fixes, so nothing shifts); a skip link (one screen, no navigation to skip).
The one `outline: none` is on a heading that takes focus when a panel opens, which is not a control.

## 7. The player view

Built in `Player.tsx`, `Transport.tsx`, `TopBar.tsx` and `QueueRail.tsx` on the system above. What
each control sends, the held slider, the keyboard commit, the cooldown and the live regions are as
they were.

### Layout, by what fits

| Pane | Stage | Queue | Strip |
|---|---|---|---|
| Under 600 px wide | the cover across the width (never taller than 46% of the pane), the words under it | follows in the same scroll | two rows: the seek bar between its two times, then the five buttons |
| 600 to 899 px | the cover with the words at its foot, beside it | follows in the same scroll | the same, with the volume at the right |
| From 900 px | the cover up to 58% of the stage, sized from the stage's own height | a rail of its own, 320 to 448 px | one row; the seek bar is its top edge; the volume, the queue toggle, settings and profile at the right |
| Short (at most 416 px tall, at least 480 px wide) | as from 900 px, with a two-line title | waits for more room (it stays a rail from 900 px) | one row |

Settings and profile are drawn once: at the end of the strip from 900 px, otherwise in the corner of
the stage on a dark disc. The queue toggle exists only where the queue is a rail.

### What changed for the listener

- The cover is about 500 px in a 1280x720 pane, where it was 230 px, and 358 px on a phone.
- A phone has a seek bar and both times; it had a 2 px line.
- The song is said once. The thumbnail and title that repeated it in the strip are kept only for the
  read-only small windows, which show nothing else.
- "Now playing" over the title is gone. Paused is the play button and a darkened cover.
- A queue row is two lines, title over artist, with the length and who asked for it at the right.
- A refused control or a lost connection is said in a notice floating over the strip's edge, beside
  the controls, where it used to push the queue down.
- "Live stream" joins the line under the artist ("Live stream, requested by mara").

### Nothing moves when the song changes

The words are three lines that are always there (an artist or a requester that is missing leaves
its line empty), bottom-aligned in a block whose outside does not change: on a phone a fixed
height, beside the cover its foot. The block is replaced with the song, not edited, and arrives by
opacity.

| The mock changing song every 1.5 s | Before | After |
|---|---|---|
| Layout shift, 1280x720 | 0.027 | 0.001 |
| Layout shift, phone | 0.142 | 0.001 |
| The play button, the strip, the cover, the artist line, the queue | the queue moved 29 px on a phone, the title 15 px, the cover 4 px | none moved |
| Frame time, median / 99th | 6.1 / 12.2 ms | 7.9 / 8.8 ms |

What is left of the shift is inside the queue's rows as their text changes. The slowest single
frame was 54 ms, once, on the first change at 1280x720 (the first blurred layer being drawn);
later changes stayed under 17 ms.

### Motion

- **The next cover** arrives over the last one, 4% from the side the queue is on, in 360 ms, once
  it has loaded. The old one stays underneath until then, so the empty frame never shows.
- **The light** changes over 600 ms the same way.
- **Progress** is a fill that is scaled, not a track that is repainted, and it moves through the
  half second between two samples, so it no longer steps. Only the seek bar's own component
  re-renders on a sample, as before. It stops gliding while a finger or the keyboard holds it.
- **A press** scales the button; the play button also grows 4% under the pointer.
- Everything is transform or opacity. Under reduced motion each of these completes at once.

### The cover's light

A second copy of the cover (the same file, already loaded), 256 px square, blurred by 40 px and
scaled five times, at 50%, under the ground laid back over it at 62%. At most 19% of the cover's
colour reaches the eye, so a pure white cover leaves ink at 10.31:1 and ink-2 at 4.74:1 (ink-3 would be 3.23:1); a test
holds both. The quietest ink is not used on the stage. The light stays inside the stage: the queue
and the strip are flat.

### Budgets

| | Before | Now |
|---|---|---|
| JavaScript, gzipped | 120.29 kB | 118.89 kB |
| CSS, minified | 11.84 kB | 22.76 kB (budget 25) |
| Tests | 60 | 108 |

### Not settled here

- A window of 640x360 or less still gets the read-only layout, because nothing in the page can tell
  Discord's picture-in-picture from a small pane of the same size. A short pane that is any wider or
  taller has its controls.
- The five backdrops are still placed for the old layout.

## 8. The rest: panels, states, backdrops, the layout event

- **Read-only windows follow Discord's layout event.** `layoutMode.ts` subscribes to
  `ACTIVITY_LAYOUT_MODE_UPDATE` once the SDK is ready and stamps `data-layout` and, for picture-in-picture
  and the grid tile, `data-glance` on `<html>`. The read-only layout keys off `data-glance`, not the window's
  size, so a small pane that is a real one keeps its controls (560x315 and 320x240 checked). No event means
  the interactive layout. Approved at Gate 3; the mock takes `&layout=pip|grid|focused`. Not verified in a real
  session: that Discord sends the event as documented, and what it sends first.
- **Settings and Profile** are built from one component, `Facts` (a label over a value under a hairline, one
  column on a phone, two with room, in a 40 rem column). Profile lost its five boxes: the level is a title and
  a bar, the figures are plain, the badges are pills. Loading shows the same grid as bars (`FactsSkeleton`).
- **Nothing is playing** has the brand mark above its line and the command chip; the error and connecting
  screens are unchanged in structure.
- **A listener without DJ rights** is told in words, under the song: "Only a DJ can control playback. Skip is a
  vote." The tooltip it replaced did not exist on a phone. It is the same all session, so nothing moves when
  the song changes.
- **A stream** has its one line centred over the controls instead of a seek bar.
- **Backdrops** are placed in the grid row between the top and the strip, so the bars stand on the strip's top
  edge at any strip height. Measured by rendering each at three sizes with the content hidden
  (`.revamp/backdrop-contrast.mjs`): waves (0.40), bars (0.20) and aurora (0.50) left the quietest ink below
  4.5:1 and were lowered to 0.13, 0.16 and 0.30; all five now clear it (4.61 to 5.18). `backdrops.test.ts`
  holds each at or under its measured ceiling. On the stage the cover's light and its scrim sit over a
  backdrop, which quietens it there.
- **Numbers:** CSS 22.87 kB minified (budget 25), JS 119.21 kB gzipped, 116 tests. Track change on the
  mock: layout shift 0.001 on both sizes; one slow frame (67 ms) on the first change at 1280x720, to look at
  in QA.

## 9. Small windows and motion

Re-checked against the baseline captures (`.revamp/baseline/mini-*`) with the minimised phone windows at
340x641, 180x340 and 120x226, each as the whole page and as the square that is shown. Nothing in
`miniWindow.ts` changed.

| Window | Result |
|---|---|
| Minimised, stack, 340x641 and 180x340 | the cover, the title, the artist and a progress line along the square's bottom edge; as before. A long title and a long artist are now cut with an ellipsis; the baseline let the artist run past the edge of the square |
| Minimised, tiny, 120x226 | the cover is the window, cropped, no words, no bar; as before |
| No artwork | the same layouts with the note on the surface |
| Picture-in-picture and the grid tile | the thumbnail, the title and artist, and a line of progress; keyed to Discord's layout event (section 8) |
| 320x240, 360x300, 400x420 | a new compact row: the cover and the words side by side, the two buttons in a column at the edge, the strip below with its seek bar and five buttons. The stacked layout needs about 450 px of height, and before this change a 320x240 pane showed the cover and nothing of the song |
| 568x320, 667x375, 844x390 (a phone held sideways) and 1000x330 | the wide layout without the queue (or with it from 900 px), the controls in one row |

### Touch

Emulated with a coarse pointer and no hover (`.revamp/probe.mjs`, `.revamp/targets.js`).

- Every interactive element on the playing view is at least 44 px in both directions, 19 of them at
  390x844 and at 320x240. The boost pill was 40 px wide; its hit area is now 48 by 44 around a 28 px
  pill.
- Both sliders are 44 px tall and keep their thumb on screen. On a pointer with a hover it appears on
  hover, focus and drag.
- Nothing is reached by hover alone: the hover states (a disc under a button, a row's ground) only
  confirm what a press would do. The dimmed controls carry their reason in words on the page, not in a
  tooltip.

### Reduced motion

Emulated `prefers-reduced-motion: reduce` on the mock with the song changing every 1.2 s, and on the
connecting screen.

| | Animations running after 3.5 s |
|---|---|
| Normal, songs changing | 1 (the progress glide, 500 ms linear) |
| Reduced, songs changing | 0 (the one arrival ran for 0.01 ms and finished) |
| Normal, connecting | 1 (the mark's pulse, endless) |
| Reduced, connecting | 0 |

Under reduced motion the progress line moves in steps twice a second and the cover and the light change
at once.

### Budgets

CSS is 23.48 kB minified (budget 25); JavaScript 119.21 kB gzipped; 116 tests.

## 10. QA

Run on 9 October 2026 against the dev server and the mock, in headless Chrome. axe-core 4.10.2 was
installed in a scratch folder outside the repository and injected through the DevTools protocol; nothing
was added to the repository or sent to any service. The scripts are in `.revamp/` (ignored by git):
`axe.mjs`, `keys.mjs`, `probe.mjs`, `measure.mjs`, `targets.js`.

| Check | Result |
|---|---|
| `npm run lint`, `npm run build` (with tsc), `npm test` in `activity/` | pass; 116 tests in 10 files |
| `node --test tests/activitySyncContract.test.js tests/activitySyncSnapshot.test.js` | 9 of 9 |
| Repo gate: `npm run lint`, `npm run typecheck`, `node scripts/sync-web-shared.js --check` | pass |
| axe (wcag2a, 2aa, 21a, 21aa, 22aa, best-practice), 24 states at 1280x720, 480x720, 320x568 and 320x240 (96 runs) | 0 violations after three fixes |
| Contrast | held in `tokens.test.ts` for every pair, the five instance palettes and ten viewer colours; axe's colour check also passed in the dark and light custom colours, Vibe 2, Vibe Dev and three backdrops |
| Keyboard, real key events | every control is a tab stop with a 2 px accent ring, in reading order (queue, then the strip); a viewer without rights skips the disabled controls; no focused element sits under the strip; Back is the one stop in a panel |
| Horizontal overflow, 320x180 to 1920x1080 | none, for the player, a long title and settings; the document never scrolls sideways |
| 200% zoom | the 640x360 and 320x180 sizes (200% of 1280x720 and 640x360) have no overflow; 195x422 (200% of a 390 px phone) clips the strip, which is below the 320 px reflow width |
| Reduced motion | 0 animations running (section 9) |
| Forced colours | edges drawn with real outlines, the seek and volume rails with GrayText and Highlight, the cover with a border |
| Console on fresh `?mock=1`, settings, frozen and `?system=1` loads | no errors or warnings |
| Screen-reader names | every control has a name; sliders say "1:09 of 3:33"; the song change and the refused control are polite live regions; one heading is visible at a time |

Fixed in QA: the screens that hold a single message (nothing playing, connecting, waiting, error) had no
level-one heading (the message is now one, and the strip's title is the heading in the read-only windows,
where the stage is hidden); a lone message scrolled in a frame under 300 px tall because of the clearance
for Discord's bottom bar, with nothing in the scroll to focus; the forced-colours rules lost to the
component rules at equal specificity and hid the seek rail (they are now the last sheet, `forced.css`).

### Budgets

| | Baseline | Final | Budget |
|---|---|---|---|
| JavaScript, gzipped | 120.29 kB | 119.23 kB | +10 kB at most |
| CSS, minified | 11.84 kB | 23.78 kB | 25 kB |
| Tests | 60 | 116 | all green |
| Images added | | none | 20 kB each |

### Track change and the seek bar

| The mock changing song every 1.5 s | Baseline | Final |
|---|---|---|
| Layout shift, 1280x720 / phone | 0.027 / 0.142 | 0.001 / 0.001 |
| What moved | the title, the artwork, on a phone the queue | on a wide pane the top of the words block, which is bottom-aligned and grows upward; nothing else |
| Frame time, median / 99th | 6.1 / 12.2 ms | 6.1 / 6.7 ms |

During steady playback the only nodes written are the seek bar's own: its fill, its input and its
elapsed time, about twice a second. The strip, the stage and the queue are not touched.

### Not verified

- A real Discord session on desktop and on a phone: the layout event, the minimised windows' real shapes,
  the safe-area allowances, real artwork and a real connection.
- A real screen reader (NVDA, VoiceOver, TalkBack); only the accessibility tree and axe.
- A real high-contrast theme: the emulation of forced colours stands in for it.
- One slow frame (about 67 ms) on the first song change at 1280x720, in software rendering. It is the first
  draw of the blurred layer and was not seen after it; it is unconfirmed on a GPU.
- Text over a real cover. The wash is tested for a pure white cover in the tokens test and axe passed on
  the mock's covers, but axe cannot measure text over an image with certainty.

### Revision after live testing: a viewer's backdrop replaces the cover's light

Seen in a real session with the marks backdrop: the cover's light and its scrim sat over the backdrop on the
stage and hid it, while the queue (flat ground) showed it, so the page read as two backgrounds. Section 8 had
accepted that quieting; it should not have. When a viewer has chosen a backdrop the stage is no longer lit
by the cover (`lit` in `Player.tsx`); the backdrop runs across the stage and the queue alike, and the accent
glow along the top edge comes back. The backdrop strengths were measured on the ground alone, so the contrast
figures in section 8 hold on the stage as they did on the queue. With no backdrop nothing changes: the stage
is lit by the cover and fades to the ground before the queue.
