import { VULNERABILITY } from "../../lib/vulnerability";

/** One quiet line: where the numbers come from, and the honesty caveat. */
export default function Footer() {
  return (
    <footer className="mt-24 border-t border-line pt-6">
      <div className="mx-auto max-w-6xl">
        <p className="max-w-[72ch] text-[12.5px] leading-relaxed text-muted">
          Figures on this site are produced by the Proteus engine against
          synthetic systems — no real utility, network, or person is involved.
          The water consequences are solved with {VULNERABILITY.solver}, the
          public EPA/Sandia hydraulic simulator, which anyone can re-run: the
          results are reproducible, not a claim about any specific real system.
        </p>
      </div>
    </footer>
  );
}
