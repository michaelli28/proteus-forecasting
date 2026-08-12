import { Reveal, Stagger, StaggerItem } from "./motion";

/**
 * Three steps, plain. A connecting rule threads them so they read as a sequence,
 * not three unrelated cards. Numbers are the only ornament, and they carry
 * order — which is exactly what a numbered step is for.
 */
const STEPS = [
  {
    n: "01",
    title: "Simulate the decision",
    body: "For each run, a modeled adversary weighs the payoff of acting now against the risk of being caught, and decides whether to spend the access it already holds. Thousands of runs map the full range of what it might do.",
  },
  {
    n: "02",
    title: "Check the forecast is honest",
    body: "A panel of independent reviewers scores the result, and the system is measured against a simulated world where the true answer is known. When the evidence is too thin to answer, it says so instead of guessing.",
  },
  {
    n: "03",
    title: "Rank exposure and defenses",
    body: "The runs are turned into a ranking: which components cause the most damage if compromised, and which defensive measures buy the most protection for the least cost.",
  },
];

export default function HowItWorks() {
  return (
    <section className="mt-20 scroll-mt-20">
      <Reveal>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          How it works
        </div>
        <h2 className="text-[22px] leading-tight">
          Three steps, no black box.
        </h2>
      </Reveal>

      <Stagger className="mt-8 grid gap-8 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <StaggerItem key={step.n} index={i} className="relative">
            <div className="flex items-baseline gap-3">
              <span className="tnum font-serif text-[28px] font-medium text-accent">
                {step.n}
              </span>
              <span className="h-px flex-1 translate-y-[-6px] bg-line" />
            </div>
            <h3 className="mt-3 text-[17px] leading-snug">{step.title}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-slate">
              {step.body}
            </p>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
