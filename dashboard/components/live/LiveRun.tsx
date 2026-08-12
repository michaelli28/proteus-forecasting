"use client";

/**
 * Watching a run happen.
 *
 * The page this replaced showed a feed that only posted when an actor's posture
 * changed, which over a 180-day run meant about five cards — and since the whole
 * run finished in a tenth of a second behind an artificial delay, the honest
 * summary of that screen was that it showed almost nothing happening, because
 * almost nothing was.
 *
 * So this one is built around the opposite claim: a run should be able to show
 * its work. A deep run replays several worlds, convenes the actors' own
 * institutional gates as model agents at the steps that mattered, and puts a
 * bench of analytic techniques over the result. That takes minutes because there
 * are minutes of work in it, and every second of it is openable — the counters
 * move because calls are in flight, and any agent on screen can be opened to
 * read exactly what it was asked and what it said.
 *
 * Nothing here is recomputed in the browser. Every number came off the stream.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MANIFEST, formatNumber } from "../../lib/live";
import type { RunEvent, ScenarioPreset } from "../../lib/live";
import { EMPTY_RUN, reduceRun, totalCost } from "../../lib/run-state";
import type { RunState } from "../../lib/run-state";
import { Card, Pill } from "../site/ui";
import { AgentMind } from "./AgentMind";
import { Councils } from "./Councils";
import { JudgesBench } from "./JudgesBench";
import { Presets } from "./Presets";
import { Worlds } from "./Worlds";

interface OpenAgent {
  label: string;
  title: string;
  subtitle: string;
}

export function LiveRun() {
  const [packId, setPackId] = useState(MANIFEST.packs[0]!.id);
  const [actorIds, setActorIds] = useState<string[]>([MANIFEST.actors[0]!.id]);
  const [respondentId, setRespondentId] = useState<string>("");
  const [defenseKind, setDefenseKind] = useState<string>("");
  const [seed, setSeed] = useState("proteus");
  const [deep, setDeep] = useState(true);
  const [branches, setBranches] = useState(6);
  const [councils, setCouncils] = useState(6);
  const [judges, setJudges] = useState(5);

  const [presetId, setPresetId] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [state, setState] = useState<RunState>(EMPTY_RUN);
  const [openAgent, setOpenAgent] = useState<OpenAgent | null>(null);
  const [wallClock, setWallClock] = useState(0);

  const sourceRef = useRef<EventSource | null>(null);
  const startedAt = useRef<number>(0);
  const pack = MANIFEST.packs.find((entry) => entry.id === packId)!;

  const stop = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    setRunning(false);
  }, []);

  const applyPreset = useCallback((preset: ScenarioPreset) => {
    setPresetId(preset.id);
    setPackId(preset.pack);
    setActorIds([...preset.actors]);
    setRespondentId(preset.respondents[0] ?? "");
    setDefenseKind(preset.defense ?? "");
    setSeed(preset.seed);
    if (preset.needsDeliberation) setDeep(true);
  }, []);

  /**
   * Any hand edit drops the preset's highlight.
   *
   * Without this, changing the actor leaves a selected question above a
   * configuration that no longer answers it — a claim on screen that the run
   * below will not support, which is the one failure this page cannot afford.
   */
  const edited = useCallback(
    <T,>(set: (value: T) => void) =>
      (value: T) => {
        setPresetId(null);
        set(value);
      },
    [],
  );

  useEffect(() => stop, [stop]);

  // A ticking clock while the run is in flight. Without it a page waiting on a
  // ninety-second council looks identical to a page that has hung.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(
      () => setWallClock(Date.now() - startedAt.current),
      250,
    );
    return () => window.clearInterval(id);
  }, [running]);

  const start = useCallback(() => {
    stop();
    setState(EMPTY_RUN);
    setOpenAgent(null);
    setWallClock(0);
    startedAt.current = Date.now();
    setRunning(true);

    const params = new URLSearchParams({
      pack: packId,
      actors: actorIds.join(","),
      seed,
      delay: "0",
    });
    if (respondentId) params.set("respondents", respondentId);
    if (defenseKind) params.set("defense", defenseKind);
    if (deep) {
      params.set("deep", "1");
      params.set("branches", String(branches));
      params.set("councils", String(councils));
      params.set("judges", String(judges));
    }

    const source = new EventSource(`/api/live?${params.toString()}`);
    sourceRef.current = source;

    source.addEventListener("run", (message) => {
      const event = JSON.parse((message as MessageEvent).data) as RunEvent;
      setState((previous) => reduceRun(previous, event));
      if (event.type === "run_finished" || event.type === "run_failed") stop();
    });

    source.addEventListener("fatal", (message) => {
      const data = JSON.parse((message as MessageEvent).data) as {
        error: string;
      };
      setState((previous) => ({ ...previous, error: data.error }));
      stop();
    });

    source.addEventListener("done", () => stop());
    source.onerror = () => {
      setState((previous) => ({
        ...previous,
        error: previous.error ?? "lost the connection to the engine",
      }));
      stop();
    };
  }, [
    packId,
    actorIds,
    respondentId,
    defenseKind,
    seed,
    deep,
    branches,
    councils,
    judges,
    stop,
  ]);

  const cost = useMemo(() => totalCost(state), [state]);
  const thinking = useMemo(
    () =>
      state.agentOrder.filter((label) => {
        const agent = state.agents[label];
        return agent && agent.text === undefined && !agent.error;
      }).length,
    [state],
  );

  const agentFor = useCallback(
    (label: string) => state.agents[label],
    [state.agents],
  );
  const onOpenAgent = useCallback(
    (label: string, title: string, subtitle: string) =>
      setOpenAgent({ label, title, subtitle }),
    [],
  );

  const opened = openAgent ? state.agents[openAgent.label] : undefined;

  return (
    <div className="mt-8">
      <Presets activeId={presetId} running={running} onPick={applyPreset} />

      <Card className="mt-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Situation">
            <select
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px]"
              value={packId}
              onChange={(event) => {
                setPresetId(null);
                setPackId(event.target.value);
                setDefenseKind("");
              }}
              disabled={running}
            >
              {MANIFEST.packs.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.id}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[12.5px] leading-snug text-muted">
              {pack.statement}
            </p>
          </Field>

          <Field label="Defensive measure">
            <select
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px]"
              value={defenseKind}
              onChange={(event) => edited(setDefenseKind)(event.target.value)}
              disabled={running}
            >
              <option value="">none — baseline run</option>
              {pack.defenses.map((defense) => (
                <option key={defense.kind} value={defense.kind}>
                  {defense.label} ({defense.costPerTick}/{pack.tickUnit})
                </option>
              ))}
            </select>
            <p className="mt-2 text-[12.5px] leading-snug text-muted">
              {pack.defenses.find((entry) => entry.kind === defenseKind)
                ?.statement ?? "Run with no mitigation, to measure against."}
            </p>
          </Field>
        </div>

        <Field label="Who is acting" className="mt-5">
          <div className="flex flex-wrap gap-2">
            {MANIFEST.actors.map((actor) => {
              const selected = actorIds.includes(actor.id);
              return (
                <button
                  key={actor.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    edited(setActorIds)(
                      selected
                        ? actorIds.filter((entry) => entry !== actor.id)
                        : [...actorIds, actor.id],
                    )
                  }
                  disabled={running}
                  title={actor.summary}
                  className={`rounded-full border px-3 py-1 text-[12.5px] transition-colors disabled:opacity-50 ${
                    selected
                      ? "border-accent bg-accent-soft text-accent-strong"
                      : "border-line bg-surface text-slate hover:border-line-strong"
                  }`}
                >
                  {actor.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Third party that responds">
            <select
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px]"
              value={respondentId}
              onChange={(event) => edited(setRespondentId)(event.target.value)}
              disabled={running}
            >
              <option value="">nobody responds</option>
              {MANIFEST.actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Seed">
            <input
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px]"
              value={seed}
              onChange={(event) => edited(setSeed)(event.target.value)}
              disabled={running}
            />
          </Field>
        </div>

        <div className="mt-6 rounded-xl border border-line bg-sunken p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={deep}
              onChange={(event) => {
                // Turning deliberation OFF under a preset that needs it leaves
                // the question above unanswerable, so the preset stops claiming
                // to be the thing configured. Turning it on breaks nothing.
                const active = MANIFEST.presets.find(
                  (entry) => entry.id === presetId,
                );
                if (!event.target.checked && active?.needsDeliberation) {
                  setPresetId(null);
                }
                setDeep(event.target.checked);
              }}
              disabled={running}
              className="mt-0.5"
            />
            <span>
              <span className="text-[13px] font-semibold text-ink">
                Deliberate for real
              </span>
              <span className="mt-1 block max-w-[70ch] text-[12.5px] leading-relaxed text-slate">
                Replays several worlds, then convenes each actor&rsquo;s own
                institutional gates as model agents at the steps that mattered
                and puts a bench of analytic techniques over the result. This
                costs money and takes minutes. Unticked, the arithmetic kernel
                alone runs, which finishes in about a tenth of a second.
              </span>
            </span>
          </label>

          {deep && (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Number
                label="Worlds to replay"
                value={branches}
                min={1}
                max={8}
                onChange={setBranches}
                disabled={running}
              />
              <Number
                label="Councils per world"
                value={councils}
                min={1}
                max={10}
                onChange={setCouncils}
                disabled={running}
              />
              <Number
                label="Adjudicators"
                value={judges}
                min={0}
                max={5}
                onChange={setJudges}
                disabled={running}
              />
              <p className="text-[12px] leading-snug text-muted sm:col-span-3">
                At most {estimateCalls(branches, councils, judges)} model calls
                — usually fewer, since a world where fewer steps qualify
                convenes fewer councils. Each council seats one agent per gate
                plus a final authority, and every one of them is openable
                afterwards.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={running ? stop : start}
            disabled={!running && actorIds.length === 0}
            className="rounded-lg bg-navy px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            {running ? "Stop" : deep ? "Run it for real" : "Run it"}
          </button>
          {actorIds.length === 0 && (
            <span className="text-[12.5px] text-muted">
              Pick at least one actor.
            </span>
          )}
        </div>
      </Card>

      {state.error && (
        <Card className="mt-6 border-warn">
          <div className="text-[13px] font-semibold text-warn">
            The run could not complete
          </div>
          <p className="mt-1 text-[13px] text-slate">{state.error}</p>
        </Card>
      )}

      {state.header && (
        <>
          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="max-w-[54ch] text-[19px]">
              {state.header.statement}
            </h2>
            <div className="tnum text-[13px] text-muted">
              {state.header.runId.slice(0, 12)} · seed {state.header.seed}
            </div>
          </div>

          <Meters
            state={state}
            cost={cost}
            thinking={thinking}
            wallClock={wallClock}
            running={running}
          />

          {state.stages.length > 0 && (
            <StageRail state={state} running={running} wallClock={wallClock} />
          )}

          <p className="mt-5 max-w-[76ch] text-[12.5px] leading-relaxed text-warn">
            {state.header.caveat}
          </p>

          <div className="mt-10">
            <Worlds
              branches={state.branches}
              order={state.branchOrder}
              harmUnit={state.header.harmUnit}
              tickUnit={state.header.tickUnit}
              totalTicks={state.header.ticks}
            />
          </div>

          {state.councils.length > 0 && (
            <div className="mt-12">
              <Councils
                councils={state.councils}
                running={running}
                agentFor={agentFor}
                onOpenAgent={onOpenAgent}
              />
            </div>
          )}

          {state.judgements.length > 0 && (
            <div className="mt-12">
              <JudgesBench
                judgements={state.judgements}
                agentFor={agentFor}
                onOpenAgent={onOpenAgent}
              />
            </div>
          )}

          {state.finished && (
            <Card className="mt-12">
              <p className="max-w-[76ch] text-[12.5px] leading-relaxed text-slate">
                Same seed, same worlds — the arithmetic in{" "}
                <span className="tnum">
                  {state.finished.runId.slice(0, 12)}
                </span>{" "}
                reproduces exactly. The councils and the bench are
                language-model judgement laid over it and will not reproduce
                word for word; that is why they never change what the kernel
                executed. Evidence class {state.finished.evidenceClass}.
              </p>
            </Card>
          )}
        </>
      )}

      {opened && openAgent && (
        <AgentMind
          agent={opened}
          title={openAgent.title}
          subtitle={openAgent.subtitle}
          onClose={() => setOpenAgent(null)}
        />
      )}
    </div>
  );
}

/**
 * The counters that prove work is happening.
 *
 * Deliberately includes the ones that move while nothing else does: elapsed
 * time, calls in flight, tokens spent. A page where the only feedback is a
 * progress bar that has been full for ninety seconds is indistinguishable from
 * a page that has stopped.
 */
function Meters({
  state,
  cost,
  thinking,
  wallClock,
  running,
}: {
  state: RunState;
  cost: ReturnType<typeof totalCost>;
  thinking: number;
  wallClock: number;
  running: boolean;
}) {
  const worldsDone = state.branchOrder.filter(
    (id) => state.branches[id]?.finished,
  ).length;

  return (
    <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
      <Readout
        value={`${Math.floor(wallClock / 60000)}:${String(
          Math.floor((wallClock % 60000) / 1000),
        ).padStart(2, "0")}`}
        label={running ? "running" : "took"}
      />
      <Readout
        value={`${worldsDone}${state.branchOrder.length > worldsDone ? ` / ${state.branchOrder.length}` : ""}`}
        label={worldsDone === 1 ? "world replayed" : "worlds replayed"}
      />
      <Readout
        value={String(state.councils.length)}
        label={state.councils.length === 1 ? "council held" : "councils held"}
      />
      <Readout
        value={
          thinking > 0 ? `${cost.calls} + ${thinking}` : String(cost.calls)
        }
        label={thinking > 0 ? "answered · thinking now" : "agents answered"}
      />
      <Readout
        value={
          cost.calls === 0
            ? "—"
            : cost.priced
              ? `$${cost.costUsd.toFixed(2)}`
              : `${formatNumber(cost.inputTokens + cost.outputTokens)}`
        }
        label={
          cost.calls === 0
            ? "spent"
            : cost.priced
              ? "spent"
              : "tokens — model not priced"
        }
      />
      {/* Only when a mitigation is actually running. A readout that says "—" on
          every baseline run is a column of nothing four times out of five. */}
      {state.defenseCost > 0 && (
        <Readout
          value={formatNumber(state.defenseCost)}
          label="spent on defence, per world"
        />
      )}
    </div>
  );
}

/**
 * What the run is doing now, and what it has already done.
 *
 * Shows each stage's DURATION rather than the offset it began at. Both are
 * available and only one answers the question a reader has: the worlds and the
 * councils both start at roughly zero seconds, and a rail reporting "0.0s" twice
 * makes a run that spent four minutes deliberating look like it did nothing.
 */
function StageRail({
  state,
  running,
  wallClock,
}: {
  state: RunState;
  running: boolean;
  wallClock: number;
}) {
  return (
    <ol className="mt-5 space-y-1.5">
      {state.stages.map((stage, index) => {
        const current = running && index === state.stages.length - 1;
        const endedAt =
          state.stages[index + 1]?.elapsedMs ??
          (running ? wallClock : state.elapsedMs);
        const seconds = Math.max(0, endedAt - stage.elapsedMs) / 1000;
        return (
          <li
            key={`${stage.stage}-${index}`}
            className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5"
          >
            <span
              className={`text-[12.5px] font-semibold ${current ? "text-accent-strong" : "text-navy"}`}
            >
              {stage.stage}
            </span>
            {current && <Pill tone="accent">working</Pill>}
            <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-slate">
              {stage.detail}
            </span>
            <span className="tnum text-[11.5px] text-muted">
              {seconds < 1
                ? "<1s"
                : `${seconds.toFixed(seconds < 60 ? 1 : 0)}s`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Readout({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="tnum font-serif text-[24px] leading-none text-navy">
        {value}
      </div>
      <div className="mt-1.5 text-[12px] leading-snug text-muted">{label}</div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[12px] font-semibold text-ink">
        {label}
      </span>
      {children}
    </label>
  );
}

function Number({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled: boolean;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(
            Math.max(min, Math.min(max, globalThis.Number(event.target.value))),
          )
        }
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px]"
      />
    </Field>
  );
}

/**
 * Roughly how many model calls the chosen settings will make.
 *
 * An estimate, and stated as one: the council count is a CAP, and a world where
 * fewer steps qualify convenes fewer. Showing the ceiling is the useful
 * direction to be wrong in — nobody is surprised by a run that cost less.
 *
 * The cap is per WORLD, across every actor in it, so multiplying by the cast
 * was double-counting: a two-actor run does not convene twice as many councils,
 * it splits the same budget between them.
 */
function estimateCalls(
  branches: number,
  councils: number,
  judges: number,
): number {
  // Each council seats one agent per documented gate, plus the chair that
  // synthesises them. Seven gates is what the researched profiles carry.
  const callsPerCouncil = 7 + 1;
  return branches * councils * callsPerCouncil + judges;
}
