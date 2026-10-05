import type { CSSProperties } from "react";

/**
 * The player's static style objects.
 *
 * **Where a rule goes, and why.** The Activity styles from two places, and the split is real
 * rather than historical — but it was never written down, which is what made every new rule a
 * coin flip. The rule:
 *
 * - **`player.css` owns everything a style object structurally cannot express**: pseudo-classes
 *   (`:hover`, `:focus`, `:disabled`), media queries and the whole responsive layout,
 *   `@font-face`, `@keyframes`, and anything scoped to a descendant. There is no inline
 *   equivalent for any of those, so this is not a preference.
 * - **This file owns the static base**: the properties that never vary and never respond to
 *   anything. Keeping them here means they sit next to the component that uses them and are
 *   typed, rather than being 52 more class names to keep in sync by hand.
 * - **Anything computed stays inline at the call site** — a theme accent, a stacking `zIndex`, a
 *   progress width. Those are values, not styles, and they cannot live in a stylesheet at all.
 *
 * Three elements deliberately straddle both (`playBtn`, `skipBtn`, `queueRow`): their
 * static base is here and their `:hover`/breakpoint behaviour is in `player.css` under the
 * matching `vibe-*` class. That is the boundary working, not a leak — but when editing one of
 * those four, check both files.
 *
 * A mechanical migration of this object into `player.css` was tried and rejected: it produces 52
 * auto-named classes in a third naming scheme, strips the reasoning comments below, and gains
 * nothing the rule above doesn't already settle.
 */
export const S: Record<string, CSSProperties> = {
  main: {
    position: "relative",
    // 100% of the reset's height chain, not 100vh — see player.css's reset comment. This is
    // the app's single scroll container (overflowY below); the document itself never scrolls.
    height: "100%",
    margin: 0,
    boxSizing: "border-box",
    // Near-black rather than pure #000 — a hair of lift keeps large flat areas from looking
    // like a hole, and stays neutral enough to sit behind any of the five instance accents.
    background: "#0b0b0d",
    color: "#f5f2f3",
    // Outfit is bundled (see player.css); the system stack behind it catches any script
    // the Latin subsets don't cover, which arbitrary track metadata regularly hits.
    fontFamily: '"Outfit", system-ui, sans-serif',
    // --vibe-accent/--vibe-accent-hover are set per-render in Shell() from the resolved
    // instance theme, not here — this object is a module-level constant shared by every
    // instance, so it can't hold an instance-specific value.
  },
  topBar: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    // There is one child, so the alignment has to be explicit or the buttons collapse to the
    // left edge.
    justifyContent: "flex-end",
    padding: "0.85rem 1.25rem",
  },
  topBarBtns: { display: "flex", gap: "0.5rem" },

  topBarBtn: {
    // 40px: Apple/Android both recommend
    // ~44px minimum touch targets, and this is a corner tap target on a control surface
    // that also has to work on mobile Activities.
    width: 40,
    height: 40,
    background: "var(--vibe-surface-hover)",
    borderRadius: 999,
    color: "#f5f2f3",
  },
  centerMessage: {
    // No margin: auto here — .vibe-body--solo centers its content itself (as a flex
    // column), so a child auto-margin isn't needed and, worse, would fight that centering
    // when a second child (Notice) was also present: see .vibe-body--solo's own comment.
    textAlign: "center",
    opacity: 0.65,
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  centerMessageError: { color: "#ff8a8a", opacity: 1 },
  // Deliberately its own style rather than reusing centerMessage's baked-in opacity: 0.65 —
  // that would compound with vibe-mark-pulse's own 0.35–0.9 animated range and read as barely
  // visible instead of "alive."
  connectingWrap: {
    margin: "auto",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.6rem",
  },
  connectingLabel: { fontSize: "0.85rem", letterSpacing: "0.02em", opacity: 0.55 },
  hintLine: { fontSize: "0.8rem", opacity: 0.8 },
  code: { background: "var(--vibe-surface)", padding: "0.1rem 0.3rem", borderRadius: 4 },

  stage: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    gap: "1.25rem",
    paddingTop: "1rem",
    minWidth: 0,
    position: "relative",
    zIndex: 1,
  },
  artFrame: {
    // Grows with the available pane. The vh term is what actually binds on a
    // typical Discord frame, and it has to stay conservative enough that artwork plus the
    // title block still clears the top bar and transport on a short window.
    width: "min(58vw, 32vh, 300px)",
    aspectRatio: "1 / 1",
    borderRadius: 14,
    overflow: "hidden",
    background: "var(--vibe-surface)",
    // boxShadow is computed per-render in Artwork() — it needs the instance's accent color.
  },
  artImage: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  artPlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  meta: { display: "flex", flexDirection: "column", gap: "0.3rem", width: "100%", maxWidth: 340 },
  eyebrow: {
    margin: 0,
    fontSize: "0.7rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    // Resolves via CSS custom-property inheritance from the value Shell() sets on <main> —
    // the one place per render that knows this instance's palette.
    color: "var(--vibe-accent)",
    fontWeight: 700,
  },
  title: { margin: "0.1rem 0 0", fontSize: "clamp(1.05rem, 4vw, 1.4rem)", lineHeight: 1.3, fontWeight: 700 },
  author: { margin: "0.15rem 0 0", opacity: 0.7, fontSize: "0.9rem" },
  requester: { margin: "0.6rem 0 0", opacity: 0.5, fontSize: "0.75rem" },

  // --- transport bar ---
  // Absolutely positioned on the bar's own top border, so progress reads as part of the edge
  // rather than as another control competing for space on a narrow frame.
  transportHairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    background: "rgba(255,255,255,0.08)",
  },
  transportHairlineFill: { height: "100%", background: "var(--vibe-accent)" },
  transportArt: { width: 44, height: 44, borderRadius: 8, objectFit: "cover", flex: "none" },
  transportArtPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    background: "var(--vibe-surface)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "none",
  },
  // minWidth: 0 here and on the flex parent is what actually lets the title ellipsise —
  // without it a long title forces the section wider and shoves the centred controls
  // off-centre.
  transportText: { display: "flex", flexDirection: "column", minWidth: 0, gap: "0.1rem" },
  transportTitle: {
    fontSize: "0.85rem",
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  transportAuthor: {
    fontSize: "0.75rem",
    opacity: 0.55,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  transportTime: {
    fontSize: "0.7rem",
    opacity: 0.5,
    fontVariantNumeric: "tabular-nums",
    flex: "none",
  },
  transportLive: { fontSize: "0.7rem", opacity: 0.55 },
  // Five buttons (shuffle and loop flank the trio); a wider gap would crowd a narrow panel.
  transportRow: { display: "flex", alignItems: "center", gap: "0.7rem" },
  playBtn: { width: 56, height: 56 },
  skipBtn: { width: 44, height: 44 },
  // Shuffle/loop recede behind the primary transport trio — no background pill, just the
  // glyph, matching how Spotify/Apple Music de-emphasize these relative to play/skip. A 38px
  // box for touch; the glyph itself stays small.
  miniBtn: { width: 38, height: 38, background: "transparent" },

  queueSection: { minWidth: 0 },
  heading: { margin: "0 0 0.6rem", fontSize: "0.75rem", textTransform: "uppercase", opacity: 0.55 },
  queue: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.15rem" },
  queueRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "0.7rem",
    alignItems: "center",
    fontSize: "0.82rem",
  },
  // The row's main control: the play-now button, laid out as picture / title / length, with the
  // browser's button look removed.
  queuePlay: {
    display: "grid",
    gridTemplateColumns: "34px 1fr auto",
    gap: "0.7rem",
    alignItems: "center",
    minWidth: 0,
    padding: 0,
    margin: 0,
    border: 0,
    background: "none",
    color: "inherit",
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
  },
  queueArtImage: { width: 34, height: 34, borderRadius: 6, objectFit: "cover", display: "block" },
  queueArtPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 6,
    background: "var(--vibe-surface)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  queueTitle: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  queueAuthor: { opacity: 0.55 },
  queueTime: { opacity: 0.5, fontVariantNumeric: "tabular-nums", fontSize: "0.75rem" },
  // Sits at the end of a row: an arrow, and the tally beside it once somebody has boosted.
  boostBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    padding: "0.2rem 0.45rem",
    // A <button>'s own look (a 2px outset border, Arial) is still there without these: this was measured in the
    // browser, not assumed.
    border: "none",
    fontFamily: "inherit",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "inherit",
    fontSize: "0.72rem",
    fontVariantNumeric: "tabular-nums",
    cursor: "pointer",
  },
  boostBtnActive: { background: "var(--vibe-accent)", color: "#0b0b0d", fontWeight: 700 },

  hint: { opacity: 0.5, fontSize: "0.8rem", margin: "0.4rem 0 0" },
  // The live region with nothing in it: out of sight and out of the layout, but in the page.
  noticeEmpty: {
    position: "absolute",
    width: 1,
    height: 1,
    margin: -1,
    padding: 0,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
  notice: {
    margin: 0,
    padding: "0.55rem 0.8rem",
    borderRadius: 8,
    background: "rgba(252, 54, 89, 0.14)",
    color: "#ffb3c0",
    fontSize: "0.8rem",
    textAlign: "center",
  },
};
