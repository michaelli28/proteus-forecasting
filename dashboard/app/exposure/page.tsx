import { Page } from "../../components/site/ui";
import { Reveal } from "../../components/site/motion";
import ExposureExplorer from "../../components/exposure/ExposureExplorer";
import Footer from "../../components/site/Footer";
import { VULNERABILITY } from "../../lib/vulnerability";

export const metadata = {
  title: "Water exposure — Proteus",
  description:
    "Where a water system is most exposed, how an intruder would move, and which defenses are worth the money.",
};

export default function ExposurePage() {
  const seeds = VULNERABILITY.seedsPerArm;

  return (
    <>
      <Page>
        <Reveal as="section" className="pt-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            Worked example · Cyber-physical
          </div>
          <h1 className="mt-3 max-w-[20ch] text-[clamp(1.9rem,4vw,2.9rem)] leading-[1.08]">
            Where a water system is most exposed.
          </h1>
          <p className="mt-5 max-w-[64ch] text-[16px] leading-relaxed text-slate">
            This is what the analysis produces for one kind of infrastructure. A
            modeled intruder that already holds access to a utility&rsquo;s
            controls decides when and how to act; a real hydraulic simulator
            works out the effect on the water. Nothing here is a real utility —
            the systems are synthetic, and the intruder is a set of choices, not
            an exploit.
          </p>
          <p className="mt-4 max-w-[64ch] text-[14px] leading-relaxed text-muted">
            Pick a system to see its exposures. Each is run through{" "}
            {(seeds * 9).toLocaleString("en-US")} simulated scenarios.
          </p>
        </Reveal>

        <div className="mt-10">
          <ExposureExplorer />
        </div>

        <Reveal as="section" className="mt-16 rounded-xl bg-sunken/50 p-6">
          <h2 className="text-[16px] leading-snug">
            One honest limit, stated plainly
          </h2>
          <p className="mt-2 max-w-[74ch] text-[13.5px] leading-relaxed text-slate">
            The water effects are <em>reproducible</em>, not <em>validated</em>.
            They come from the public EPA/Sandia hydraulic simulator, so anyone
            can re-run them and get the same answer — but that simulator is also
            the yardstick, so the analysis does not claim to have been checked
            against a real attacked utility. The rankings are a rigorous
            statement about the model, not a prediction about any specific real
            system.
          </p>
        </Reveal>
      </Page>
      <Footer />
    </>
  );
}
