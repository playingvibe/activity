import type { ReactNode } from "react";

/**
 * A list of labelled values: what a panel is made of. A setting ("DJ roles: DJ, Moderator") and a
 * statistic ("Current streak: 12 days") are the same thing, so one component draws both, in a grid
 * that is one column on a phone and two where there is room. A description list, so a screen reader
 * says each label with its value.
 */
export function Facts({ children }: { children: ReactNode }) {
  return <dl className="vibe-facts">{children}</dl>;
}

export function Fact({
  label,
  hint,
  badge,
  wide = false,
  children,
}: {
  label: string;
  hint?: string;
  /** Beside the label, where it is true of this one fact only (a badge on every row is a badge nobody reads). */
  badge?: ReactNode;
  /** Takes the whole row, for a value that is a row of its own (badges). */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="vibe-fact" data-wide={wide ? "" : undefined}>
      <dt className="vibe-fact__label">
        {label}
        {badge}
      </dt>
      <dd className="vibe-fact__value">{children}</dd>
      {hint && <dd className="vibe-hint">{hint}</dd>}
    </div>
  );
}

/**
 * The shape of a panel's content while it loads: the same grid, with bars where the text will be, so
 * the panel does not jump when it arrives. Decoration only; the words that say what is happening are
 * the caller's.
 */
export function FactsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="vibe-facts" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="vibe-fact" key={i}>
          <span className="vibe-skeleton vibe-skeleton--label" />
          <span className="vibe-skeleton" />
        </div>
      ))}
    </div>
  );
}
