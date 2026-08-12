import Link from "next/link";
import { Page } from "../components/site/ui";
import { Reveal, Stagger, StaggerItem } from "../components/site/motion";
import DomainGrid from "../components/site/DomainGrid";
import Footer from "../components/site/Footer";
import HowItWorks from "../components/site/HowItWorks";
import HeadlineFindings from "../components/site/HeadlineFindings";

export const metadata = {
  title: "Proteus — national-security forecasting",
  description:
    "Forecasts national-security questions, simulates the attacker's decisions, and ranks where critical systems are most exposed.",
};

export default function OverviewPage() {
  return (
    <>
      <Page>
        {/* Hero — a plain statement of what this is, asymmetric, no metric template. */}
        <Reveal as="section" className="pt-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            National-security forecasting
          </div>
          <h1 className="mt-3 max-w-[16ch] text-[clamp(2.1rem,5vw,3.4rem)] leading-[1.05]">
            See the attack decision before it happens.
          </h1>
          <p className="mt-5 max-w-[60ch] text-[17px] leading-relaxed text-slate">
            Proteus simulates an attacker&rsquo;s <em>decisions</em> — not its
            code — thousands of times over, then ranks where a system is most
            exposed and which defenses are actually worth the money. It never
            touches a real network or a real person.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/exposure"
              className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-[14px] font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              See the water example
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/calibration"
              className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:bg-sunken"
            >
              How honest are the forecasts?
            </Link>
          </div>
        </Reveal>

        {/* What it is / isn't — one line each, sets expectations honestly. */}
        <Reveal as="section" delay={0.1} className="mt-14">
          <Stagger className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
            {[
              {
                k: "It forecasts",
                v: "A probability for one specific question that can later be checked — with the uncertainty stated, not hidden.",
              },
              {
                k: "It plays the attacker",
                v: "An attacker that weighs the payoff against the risk of getting blamed, and decides when to spend the access it already has.",
              },
              {
                k: "It ranks",
                v: "The parts that do the most damage if an attacker takes them, and the defenses that buy the most protection per dollar.",
              },
            ].map((item, i) => (
              <StaggerItem key={item.k} index={i} className="bg-surface p-5">
                <div className="font-serif text-[16px] font-semibold text-navy">
                  {item.k}
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate">
                  {item.v}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
        </Reveal>

        <HowItWorks />

        <HeadlineFindings />

        {/* Coverage — the multi-domain answer. */}
        <section className="mt-20 scroll-mt-20">
          <Reveal>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
              Where it applies
            </div>
            <h2 className="text-[22px] leading-tight">
              One method, many kinds of threat.
            </h2>
            <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-slate">
              The same engine works anywhere an attacker has to make a costly
              choice without knowing how it will turn out — breaking physical
              equipment is only the easiest to picture. Water is the worked
              example here because its consequences can be checked against real
              physics.
            </p>
          </Reveal>
          <div className="mt-6">
            <DomainGrid />
          </div>
        </section>
      </Page>
      <Footer />
    </>
  );
}
