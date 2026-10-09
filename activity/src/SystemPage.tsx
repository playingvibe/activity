import type { CSSProperties, ReactNode } from "react";
import { INSTANCE_THEMES } from "./generated/instances";
import { resolveClientId } from "./discord";
import { resolveTheme, themeFromAccent } from "./theme";
import { Shell, CenterMessage, ConnectingState, Notice } from "./Shell";
import { Artwork } from "./Transport";
import { Queue } from "./QueueRail";
import { Fact, Facts, FactsSkeleton } from "./Facts";
import { MOCK_SYNC } from "./mockSync";
import {
  BackIcon,
  LoopIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  QueueIcon,
  SettingsIcon,
  ShuffleIcon,
  SkipIcon,
  VolumeIcon,
} from "./icons";
import "./styles/index.css";
import "./styles/system.css";

/**
 * `?system=1`: every token and component on one page, in every state, for looking at the system
 * without a song playing. `&client=<id>` or `&accent=<hex>` picks the palette, as in the mock.
 * Loaded on demand by `App`, so none of it is in the bundle a real session downloads.
 */
export default function SystemPage({ params }: { params: URLSearchParams }) {
  const accent = params.get("accent");
  const theme = accent ? themeFromAccent(`#${accent}`) : resolveTheme(resolveClientId() ?? "");
  const queue = MOCK_SYNC.status.phase === "ready" ? (MOCK_SYNC.status.state.queue ?? []) : [];
  const rows = [
    ...queue.slice(0, 3),
    { ...queue[3]!, title: "A title long enough that it has to be cut off before the length", thumbnail: null },
    { ...queue[4]!, isStream: true },
  ];
  const noop = () => {};

  return (
    <Shell theme={theme}>
      <div className="vibe-system">
        <header className="vibe-system__head">
          <h1 className="vibe-panel__title">System: {theme.name}</h1>
          <nav className="vibe-system__themes" aria-label="Palette">
            {Object.entries(INSTANCE_THEMES).map(([id, t]) => (
              <a key={id} href={`?system=1&mock=1&client=${id}`}>
                {t.name}
              </a>
            ))}
            <a href="?system=1&accent=fff3c4">Light custom</a>
            <a href="?system=1&accent=1a0033">Dark custom</a>
          </nav>
        </header>

        <Block title="Colour">
          <div className="vibe-system__swatches">
            {["ground", "surface", "surface-2", "accent", "accent-hover", "accent-soft", "ink", "ink-2", "ink-3", "danger"].map((name) => (
              <div key={name} className="vibe-system__swatch" style={{ "--swatch": `var(--${name})` } as CSSProperties}>
                <span />
                {name}
              </div>
            ))}
          </div>
          <div className="vibe-system__grounds">
            {["ground", "surface", "surface-2"].map((ground) => (
              <p key={ground} style={{ background: `var(--${ground})` }}>
                <span style={{ color: "var(--ink)" }}>ink</span> <span style={{ color: "var(--ink-2)" }}>ink-2</span>{" "}
                <span style={{ color: "var(--ink-3)" }}>ink-3</span> <span style={{ color: "var(--accent)" }}>accent</span>{" "}
                <span style={{ color: "var(--danger)" }}>danger</span> on {ground}
              </p>
            ))}
          </div>
        </Block>

        <Block title="Type">
          {[
            ["step-3", "24, a panel's main number"],
            ["step-2", "20, panel titles"],
            ["step-1", "17, values and messages"],
            ["step-0", "15, body and queue titles"],
            ["step--1", "13, supporting text"],
            ["step--2", "12, times"],
          ].map(([step, use]) => (
            <p key={step} style={{ fontSize: `var(--${step})` }}>
              Paper Lanterns <span className="vibe-hint">{step}: {use}</span>
            </p>
          ))}
        </Block>

        <Block title="Icon button">
          <Row label="Quiet">
            <button className="vibe-btn" aria-label="Shuffle queue"><ShuffleIcon /></button>
            <button className="vibe-btn" aria-label="Settings"><SettingsIcon /></button>
            <button className="vibe-btn" disabled aria-label="Shuffle queue, disabled"><ShuffleIcon /></button>
          </Row>
          <Row label="Strong">
            <button className="vibe-btn vibe-btn--strong" aria-label="Previous track"><PreviousIcon /></button>
            <button className="vibe-btn vibe-btn--strong" aria-label="Skip"><SkipIcon /></button>
            <button className="vibe-btn vibe-btn--strong" disabled aria-label="Skip, disabled"><SkipIcon /></button>
          </Row>
          <Row label="Tonal">
            <button className="vibe-btn vibe-btn--tonal" aria-label="Back"><BackIcon /></button>
          </Row>
          <Row label="Toggle: off, on">
            <button className="vibe-btn" aria-pressed={false} aria-label="Show queue"><QueueIcon /></button>
            <button className="vibe-btn" aria-pressed aria-label="Hide queue"><QueueIcon /></button>
          </Row>
          <Row label="Repeat: off, all, one">
            <button className="vibe-btn vibe-loop" data-mode="off" aria-label="Repeat: off"><LoopIcon /></button>
            <button className="vibe-btn vibe-loop" data-mode="queue" aria-label="Repeat: queue"><LoopIcon mode="queue" /></button>
            <button className="vibe-btn vibe-loop" data-mode="track" aria-label="Repeat: track"><LoopIcon mode="track" /></button>
            <button className="vibe-btn vibe-loop" data-mode="queue" disabled aria-label="Repeat: queue, disabled"><LoopIcon mode="queue" /></button>
          </Row>
        </Block>

        <Block title="Play">
          <Row label="Pause, play, disabled">
            <button className="vibe-play" aria-label="Pause"><PauseIcon /></button>
            <button className="vibe-play" aria-label="Play"><PlayIcon /></button>
            <button className="vibe-play" disabled aria-label="Play, disabled"><PlayIcon /></button>
          </Row>
        </Block>

        <Block title="Slider">
          <Row label="Seek">
            <span className="vibe-time vibe-num">1:08</span>
            <Slider label="Seek" value={32} />
            <span className="vibe-time vibe-num">3:33</span>
          </Row>
          <Row label="Volume">
            <VolumeIcon />
            <Slider label="Volume" value={70} quiet />
          </Row>
          <Row label="Disabled">
            <Slider label="Seek, disabled" value={32} disabled />
          </Row>
          <Row label="Meter">
            <div className="vibe-meter" style={{ flex: 1 }}>
              <div className="vibe-meter__fill" style={{ transform: "scaleX(0.3)" }} />
            </div>
          </Row>
        </Block>

        <Block title="Cover and thumbnail">
          <Row label="No artwork (the mock has none)">
            <div className="vibe-system__cover"><Artwork src={null} /></div>
            <span className="vibe-thumb" />
          </Row>
        </Block>

        <Block title="Queue row and boost">
          <Queue tracks={rows} total={300} boostRequired={2} onJump={noop} onBoost={noop} />
          <p className="vibe-hint">Disabled, while not connected:</p>
          <Queue tracks={rows.slice(0, 2)} disabled boostRequired={2} onJump={noop} onBoost={noop} />
          <p className="vibe-hint">Empty:</p>
          <Queue tracks={[]} onJump={noop} />
        </Block>

        <Block title="Badge, code, hint">
          <Row label="Badge">
            <span className="vibe-badge">this bot only</span>
            <span className="vibe-badge" style={{ "--badge": "#F5C542" } as CSSProperties}>Gold Listener</span>
          </Row>
          <Row label="Command">
            <span>Start something with <code className="vibe-code">/play</code> in chat.</span>
          </Row>
          <Row label="Hint">
            <span className="vibe-hint">Keeps playing when the queue runs out.</span>
          </Row>
        </Block>

        <Block title="Notice and messages">
          <Notice>Only a DJ can control playback here.</Notice>
          <CenterMessage mark title="Nothing is playing right now.">
            <span className="vibe-hint">Start something with <code className="vibe-code">/play</code> in chat.</span>
          </CenterMessage>
          <CenterMessage error title="Lost the connection to Vibe. Close the Activity and open it again." />
          <ConnectingState reason="Join the voice channel Vibe is playing in to control playback." />
        </Block>

        <Block title="Facts">
          <Facts>
            <Fact label="Current streak">12 days</Fact>
            <Fact label="DJ roles" hint="Skip without a vote, and bypass most restrictions." badge={<span className="vibe-badge">this bot only</span>}>
              DJ, Moderator
            </Fact>
          </Facts>
          <p className="vibe-hint">Loading:</p>
          <FactsSkeleton count={2} />
        </Block>

        <Block title="Cover's note for a listener without rights">
          <p className="vibe-now__note">Only a DJ can control playback. Skip is a vote.</p>
        </Block>
      </div>
    </Shell>
  );
}

/** The slider's markup with a fixed value: the real one is `HeldRange` in Transport.tsx, which needs a connection to hold. */
function Slider({ label, value, quiet, disabled }: { label: string; value: number; quiet?: boolean; disabled?: boolean }) {
  return (
    <span className={`vibe-slider${quiet ? " vibe-slider--quiet" : ""}`}>
      <span className="vibe-meter">
        <span className="vibe-meter__fill" style={{ transform: `scaleX(${value / 100})` }} />
      </span>
      <input className="vibe-range" type="range" defaultValue={value} disabled={disabled} aria-label={label} />
    </span>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="vibe-system__block">
      <h2 className="vibe-heading">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="vibe-system__row">
      <span className="vibe-hint">{label}</span>
      {children}
    </div>
  );
}
