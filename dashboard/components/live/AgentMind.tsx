"use client";

/**
 * One agent, opened up.
 *
 * Everything here is the unedited record of a single model call: the system
 * prompt it was given, the prompt it answered, and the completion it returned
 * before any schema touched it. The raw text is shown as it arrived — code
 * fences, stray prose and all — because a tidied transcript is a claim about
 * what the model said rather than the thing it said.
 *
 * The repair rounds matter as much as the answer. A seat that had to be asked
 * three times was asked badly the first time, and that is a fact about the
 * system worth seeing rather than an embarrassment worth hiding.
 */

import { useEffect } from "react";
import type { AgentRecord } from "../../lib/run-state";

export function AgentMind({
  agent,
  title,
  subtitle,
  onClose,
}: {
  agent: AgentRecord;
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  // Escape closes, because a panel that covers the page and traps the reader is
  // worse than no panel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tokens =
    agent.inputTokens !== undefined || agent.outputTokens !== undefined
      ? `${(agent.inputTokens ?? 0).toLocaleString()} in · ${(agent.outputTokens ?? 0).toLocaleString()} out`
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-navy/25"
      role="dialog"
      aria-modal="true"
      aria-label={`What ${title} was asked and answered`}
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-3xl overflow-y-auto border-l border-line bg-surface shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 border-b border-line bg-surface/95 px-6 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-[17px] leading-tight">{title}</h2>
              {subtitle && (
                <p className="mt-1 text-[12.5px] leading-snug text-slate">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-slate hover:border-line-strong"
            >
              Close
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
            <span>{agent.model || "model not recorded"}</span>
            {agent.durationMs !== undefined && (
              <span>{(agent.durationMs / 1000).toFixed(1)}s thinking</span>
            )}
            {tokens && <span>{tokens}</span>}
            {agent.costUsd !== undefined ? (
              <span>${agent.costUsd.toFixed(4)}</span>
            ) : (
              <span>cost not priced for this model</span>
            )}
            {agent.retries.length > 0 && (
              <span className="text-warn">
                asked {agent.retries.length + 1} times
              </span>
            )}
          </div>
        </header>

        <div className="space-y-6 px-6 py-6">
          {agent.error && (
            <section>
              <SectionLabel>This agent never answered</SectionLabel>
              <p className="mt-2 rounded-lg border border-warn bg-warn-soft px-4 py-3 text-[13px] leading-relaxed text-warn">
                {agent.error}
              </p>
            </section>
          )}

          {agent.text !== undefined && (
            <section>
              <SectionLabel>What it said, unedited</SectionLabel>
              <Block text={agent.text} tone="answer" />
            </section>
          )}

          {agent.retries.length > 0 && (
            <section>
              <SectionLabel>Where it was sent back</SectionLabel>
              <ol className="mt-2 space-y-2">
                {agent.retries.map((retry) => (
                  <li
                    key={retry.attempt}
                    className="rounded-lg border border-line bg-sunken px-4 py-2.5 text-[12.5px] leading-relaxed text-slate"
                  >
                    <span className="font-semibold text-ink">
                      attempt {retry.attempt}
                    </span>{" "}
                    — {retry.reason}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section>
            <SectionLabel>What it was asked</SectionLabel>
            <Block text={agent.prompt} tone="prompt" />
          </section>

          <section>
            <SectionLabel>Who it was told it was</SectionLabel>
            <Block text={agent.system} tone="prompt" />
          </section>

          <p className="border-t border-line pt-4 text-[11.5px] leading-relaxed text-muted">
            Stream label <span className="tnum text-slate">{agent.label}</span>.
            This is the whole record of the call — nothing on this panel was
            summarised or rewritten.
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
      {children}
    </div>
  );
}

/**
 * A block of model text.
 *
 * Long prompts are tall, and a panel that forces the reader past two thousand
 * words of system prompt to reach the answer has buried the answer. So each
 * block scrolls in its own box and the answer is the one that opens first.
 */
function Block({ text, tone }: { text: string; tone: "prompt" | "answer" }) {
  const styles =
    tone === "answer"
      ? "border-accent/40 bg-accent-soft/40 text-ink"
      : "border-line bg-sunken text-slate";
  return (
    <pre
      className={`mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-lg border px-4 py-3 font-mono text-[12px] leading-relaxed ${styles}`}
    >
      {text || "(empty)"}
    </pre>
  );
}
