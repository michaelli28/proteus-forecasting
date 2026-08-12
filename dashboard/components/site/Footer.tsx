import { VULNERABILITY } from "../../lib/vulnerability";

/** One quiet line: where the numbers come from, and the honesty caveat. */
export default function Footer() {
  return (
    <footer className="mt-24 border-t border-line pt-6">
      <div className="mx-auto max-w-6xl">
        <p className="max-w-[72ch] text-[12.5px] leading-relaxed text-muted">
          Numbers on this site come from the Proteus engine running against
          made-up systems — no real utility, network, or person is involved. The
          water effects are worked out with {VULNERABILITY.solver}, the public
          EPA/Sandia water-flow simulator, which anyone can re-run and get the
          same numbers: they are not a claim about any specific real system.
        </p>
      </div>
    </footer>
  );
}
