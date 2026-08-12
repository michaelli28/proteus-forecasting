import { Pill } from "./ui";
import { Stagger, StaggerItem } from "./motion";

/**
 * The coverage map — what the method reaches beyond the water example.
 *
 * Honest by construction: each domain carries its real maturity. "Live" means a
 * working simulation exists in the engine; "modeled" means the adversary logic
 * is built but not yet a full worked example; "designed" means it is specified
 * in the threat catalogue but not yet coded. A designed domain is drawn quieter
 * than a live one, so the eye is never told something is further along than it is.
 */
type Maturity = "live" | "modeled" | "designed";

interface Domain {
  name: string;
  vector: string;
  blurb: string;
  maturity: Maturity;
}

const DOMAINS: Domain[] = [
  {
    name: "Water & critical infrastructure",
    vector: "Sabotage by hacking",
    blurb:
      "When an attacker already inside a utility's controls decides to act — and what that does to the water. The effects are worked out with the same public water-flow simulator the government co-wrote.",
    maturity: "live",
  },
  {
    name: "Disinformation",
    vector: "Spreading false claims",
    blurb:
      "How far a false claim spreads through a population, and whether someone watching only public activity could tell it was an organized campaign.",
    maturity: "live",
  },
  {
    name: "Insider recruitment",
    vector: "Spies and informants",
    blurb:
      "How an attacker gets from first contact to a recruited insider, and where that process is easiest to interrupt.",
    maturity: "live",
  },
  {
    name: "Economic coercion",
    vector: "Sanctions & supply chain",
    blurb:
      "When pressure on an industry a country depends on changes how it behaves — and when it just finds a way around the sanctions instead.",
    maturity: "designed",
  },
  {
    name: "Geopolitical escalation",
    vector: "Military signalling",
    blurb:
      "Reading a ladder of escalation — incursions, exercises, deployments — as separate moves with different meanings, not one blurred threat level.",
    maturity: "designed",
  },
];

const MATURITY: Record<
  Maturity,
  { label: string; tone: "good" | "accent" | "neutral" }
> = {
  live: { label: "Live example", tone: "good" },
  modeled: { label: "Modeled", tone: "accent" },
  designed: { label: "Designed", tone: "neutral" },
};

export default function DomainGrid() {
  return (
    <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {DOMAINS.map((domain, i) => {
        const m = MATURITY[domain.maturity];
        const live = domain.maturity === "live";
        return (
          <StaggerItem key={domain.name} index={i}>
            <article
              className={`flex h-full flex-col rounded-xl border p-5 transition-shadow ${
                live
                  ? "border-line bg-surface shadow-[0_1px_2px_rgba(20,30,50,0.04)] hover:shadow-[0_4px_16px_rgba(20,30,50,0.07)]"
                  : "border-line/70 bg-sunken/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  {domain.vector}
                </div>
                <Pill tone={m.tone}>{m.label}</Pill>
              </div>
              <h3
                className={`mt-2.5 text-[17px] leading-snug ${live ? "text-navy" : "text-slate"}`}
              >
                {domain.name}
              </h3>
              <p
                className={`mt-2 text-[13.5px] leading-relaxed ${live ? "text-slate" : "text-muted"}`}
              >
                {domain.blurb}
              </p>
            </article>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
