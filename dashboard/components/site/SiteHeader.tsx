"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Top navigation. Five destinations, plain names.
 *
 * The active link is the only one that gets the navy weight and the underline —
 * every other tab stays quiet, so the eye lands on where you are without a busy
 * bar of equally-loud options.
 */
const NAV = [
  { href: "/", label: "Overview" },
  { href: "/live", label: "Watch a run" },
  { href: "/actors", label: "Actors" },
  { href: "/exposure", label: "Water exposure" },
  { href: "/calibration", label: "Forecast quality" },
  { href: "/runs", label: "Runs" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ground/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <ProteusMark />
          <span className="font-serif text-[17px] font-semibold tracking-tight text-navy">
            Proteus
          </span>
        </Link>

        {/*
          Scrolls rather than wraps on narrow screens. Wrapping would push the
          header past its fixed height and drop the active underline onto the
          row below it; scrolling keeps one row and the underline geometry
          intact. The scrollbar is hidden because a tab strip that only
          sometimes shows a bar reads as a rendering fault.
        */}
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-[13.5px] transition-colors ${
                  active
                    ? "font-semibold text-navy"
                    : "font-medium text-slate hover:text-ink"
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[11px] h-[2px] rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

/**
 * The mark: three nested arcs — a shifting form settling into order, which is
 * what the platform does with a messy question. Small, quiet, not a logo
 * exercise.
 */
function ProteusMark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <circle
        cx="11"
        cy="11"
        r="9.2"
        stroke="var(--color-navy)"
        strokeWidth="1.4"
      />
      <path
        d="M11 3.5a7.5 7.5 0 0 1 0 15"
        stroke="var(--color-accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="11" cy="11" r="2.4" fill="var(--color-navy)" />
    </svg>
  );
}
