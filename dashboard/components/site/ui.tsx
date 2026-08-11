/**
 * Shared, unfussy UI atoms. Server components except where noted.
 *
 * Deliberately few: a page container, a section with an eyebrow, a plain card, a
 * key-figure, a status pill that renders ONLY when its state is exceptional, and
 * a horizontal magnitude bar for ranked tables. Nothing wraps content that does
 * not need wrapping.
 */

import type { ReactNode } from "react";

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-6xl px-6 pb-24 pt-10">{children}</main>;
}

/** Small uppercase eyebrow over a heading. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
      {children}
    </div>
  );
}

export function Section({
  eyebrow,
  title,
  lede,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-16 scroll-mt-20 ${className}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="text-[22px] leading-tight">{title}</h2>
      {lede && (
        <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-slate">
          {lede}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(20,30,50,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

/** A key figure: big number, quiet label, optional one-line note. */
export function Figure({
  value,
  label,
  note,
  tone = "ink",
}: {
  value: ReactNode;
  label: string;
  note?: string;
  tone?: "ink" | "accent" | "good" | "warn";
}) {
  const toneClass = {
    ink: "text-navy",
    accent: "text-accent-strong",
    good: "text-good",
    warn: "text-warn",
  }[tone];
  return (
    <div>
      <div className={`tnum font-serif text-[30px] leading-none ${toneClass}`}>
        {value}
      </div>
      <div className="mt-2 text-[13px] font-medium text-ink">{label}</div>
      {note && (
        <div className="mt-1 max-w-[34ch] text-[12.5px] leading-snug text-muted">
          {note}
        </div>
      )}
    </div>
  );
}

type PillTone = "good" | "warn" | "accent" | "neutral";

/**
 * A status pill. Renders only when passed a tone — the caller is expected to
 * skip it for the ordinary case, so a pill on screen always means "this row is
 * different from its neighbours".
 */
export function Pill({
  children,
  tone,
}: {
  children: ReactNode;
  tone: PillTone;
}) {
  const styles: Record<PillTone, string> = {
    good: "bg-good-soft text-good",
    warn: "bg-warn-soft text-warn",
    accent: "bg-accent-soft text-accent-strong",
    neutral: "bg-sunken text-slate",
  };
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * A horizontal magnitude bar for a ranked table cell.
 *
 * `fraction` is 0–1 of the row's value against the column max. The bar sits
 * behind a right-aligned number so the reader gets the shape and the figure in
 * one glance without a separate chart.
 */
export function MagnitudeCell({
  fraction,
  children,
  tone = "accent",
}: {
  fraction: number;
  children: ReactNode;
  tone?: "accent" | "warn" | "good";
}) {
  const barColor = {
    accent: "var(--color-accent-soft)",
    warn: "var(--color-warn-soft)",
    good: "var(--color-good-soft)",
  }[tone];
  const width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
  return (
    <div className="relative">
      <div
        className="absolute inset-y-0 left-0 rounded-[3px]"
        style={{ width, background: barColor }}
        aria-hidden
      />
      <div className="relative tnum px-2 py-1.5 text-right text-[13px] text-ink">
        {children}
      </div>
    </div>
  );
}
