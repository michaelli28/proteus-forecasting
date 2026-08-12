/**
 * The pieces a dossier is built from.
 *
 * One shape recurs everywhere on these pages: a claim, and the document behind
 * it. `Claim` renders that pair with the source folded away, because a reader
 * scanning how an actor decides wants the claims, and a reader checking the work
 * wants every citation — and those are different visits to the same page.
 *
 * Only LOW confidence is marked. Marking all three levels would put a badge on
 * every line, where it stops distinguishing anything and becomes decoration; the
 * exceptional state gets the ink.
 */

import type { ReactNode } from "react";
import type { Confidence, SourcedClaim } from "../../lib/dossier";
import { parseProse, parseSpans } from "../../lib/prose";
import { Pill } from "../site/ui";

export function Claim({
  claim,
  className = "",
}: {
  claim: SourcedClaim;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-start gap-2">
        <p className="flex-1 text-[13.5px] leading-relaxed text-ink">
          <Inline line={claim.statement} />
        </p>
        {claim.confidence === "low" && <Pill tone="warn">thin evidence</Pill>}
      </div>
      <Basis basis={claim.basis} confidence={claim.confidence} />
    </div>
  );
}

/** The citation, folded away until asked for. */
export function Basis({
  basis,
  confidence,
  label = "source",
}: {
  basis: string;
  confidence?: Confidence;
  label?: string;
}) {
  return (
    <details className="group mt-1.5">
      <summary className="cursor-pointer list-none text-[11.5px] text-muted underline decoration-dotted underline-offset-2 hover:text-slate">
        {label}
        {confidence ? ` · ${confidence} confidence` : ""}
      </summary>
      <p className="mt-1.5 break-words border-l-2 border-line pl-3 text-[12.5px] leading-relaxed text-slate">
        <Inline line={basis} />
      </p>
    </details>
  );
}

/**
 * A section that states plainly when it has nothing in it.
 *
 * An unwritten section rendered as absence is the honest outcome and the useful
 * one: it tells a reader which part of this actor is still eleven numbers, and
 * it tells them what the engine does in the meantime.
 */
export function DossierSection({
  title,
  lede,
  empty,
  children,
}: {
  title: string;
  lede?: string;
  empty?: string;
  children?: ReactNode;
}) {
  return (
    <section className="mt-12 border-t border-line pt-7">
      <h2 className="text-[19px] leading-tight">{title}</h2>
      {lede && (
        <p className="mt-2 max-w-[72ch] text-[13.5px] leading-relaxed text-slate">
          {lede}
        </p>
      )}
      {empty ? (
        <p className="mt-4 max-w-[72ch] rounded-lg border border-dashed border-line bg-sunken px-4 py-3 text-[13px] leading-relaxed text-muted">
          {empty}
        </p>
      ) : (
        <div className="mt-5">{children}</div>
      )}
    </section>
  );
}

/**
 * A researcher's long-form note, rendered as the document it was written as.
 *
 * These run to several thousand words of argued caveats and are the part of a
 * profile a reviewer most needs to be able to read. Headings and lists carry
 * the structure of that argument, so flattening them loses the argument itself,
 * not just its formatting.
 */
export function Prose({ source }: { source: string }) {
  return (
    <div className="max-w-[78ch] space-y-3 break-words">
      {parseProse(source).map((block, index) => {
        if (block.kind === "heading") {
          return (
            <h3
              key={index}
              className="pt-2 text-[13px] font-semibold text-navy first:pt-0"
            >
              <Inline line={block.text} />
            </h3>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={index} className="space-y-2">
              {block.items.map((item, at) => (
                <li
                  key={at}
                  className="border-l-2 border-line pl-3.5 text-[13.5px] leading-relaxed text-ink"
                >
                  <Inline line={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="text-[13.5px] leading-relaxed text-ink">
            <Inline line={block.text} />
          </p>
        );
      })}
    </div>
  );
}

/** One line of research prose with its emphasis rendered rather than printed. */
export function Inline({ line }: { line: string }) {
  return (
    <>
      {parseSpans(line).map((span, index) => {
        if (span.kind === "bold") {
          // The research routinely bolds a parameter name — **`proxyPreference`
          // (0.55)** — so a bold span that renders its contents as flat text
          // shows the backticks. Recursing once is enough: the bold pattern
          // cannot contain another bold, so this terminates.
          return (
            <strong key={index} className="font-semibold text-navy">
              <Inline line={span.text} />
            </strong>
          );
        }
        if (span.kind === "italic") {
          return <em key={index}>{span.text}</em>;
        }
        if (span.kind === "code") {
          return (
            <code
              key={index}
              className="rounded bg-sunken px-1 py-0.5 text-[12.5px] text-slate"
            >
              {span.text}
            </code>
          );
        }
        return <span key={index}>{span.text}</span>;
      })}
    </>
  );
}

/** A 0–1 parameter, drawn so the position is readable before the number is. */
export function ParameterBar({ value }: { value: number }) {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-sunken">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-accent"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        aria-hidden
      />
    </div>
  );
}
