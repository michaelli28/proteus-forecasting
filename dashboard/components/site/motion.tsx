"use client";

/**
 * Motion primitives — one restrained vocabulary for the whole site.
 *
 * Everything fades and rises a few pixels, or counts a number up once, on a
 * 200–400ms ease-out. No bounce, no spring, no attention-seeking.
 *
 * These are MOUNT-triggered, not scroll-triggered. Scroll-into-view detection
 * (IntersectionObserver / whileInView) proved unreliable here — content could be
 * left faded and counters stuck at zero if the observer never fired. Mount
 * triggering guarantees every element reaches its final, fully-legible state,
 * which for a document that will be read and screenshotted matters more than a
 * reveal that waits for the scroll position. Reduced-motion still short-circuits
 * to the final state with no animation.
 */

import { useMotionValue, useReducedMotion, animate } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const; // ease-out-quint

/**
 * Fade + rise on mount, via a CSS keyframe (see globals.css `.u-reveal`).
 *
 * CSS rather than a JS transition on purpose: the element's natural state is
 * fully visible, so content can never be stranded invisible by a throttled
 * animation loop. `delay` staggers via animation-delay.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  return (
    <Tag
      className={`u-reveal ${className}`}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </Tag>
  );
}

/**
 * A container for a group of StaggerItems. A plain element — it does NOT drive
 * its children via variant propagation.
 *
 * Framer's parent→child variant propagation ("animate" a label on the parent,
 * let children inherit it) did not reach children reliably here, leaving them
 * stuck at their hidden initial state. Each StaggerItem now animates itself on
 * mount instead, so visibility never depends on propagation working.
 */
export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

/**
 * A single item that fades and rises on mount. `index` staggers the group by a
 * small per-item delay; omit it and items reveal together.
 *
 * A standalone named export, NOT a static property on Stagger — a "use client"
 * module's exports become opaque references when imported into a server
 * component, and a property hung off a component function is dropped at that
 * boundary and renders as undefined.
 */
export function StaggerItem({
  children,
  className = "",
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <div
      className={`u-reveal ${className}`}
      style={{ animationDelay: `${0.05 + index * 0.07}s` }}
    >
      {children}
    </div>
  );
}

/**
 * Count a number up from zero once, on mount.
 *
 * Returns a formatted string so the caller controls units and precision. Under
 * reduced-motion it snaps straight to the final value.
 */
export function useCountUp(
  target: number,
  format: (v: number) => string,
  { duration = 1.1, delay = 0.1 }: { duration?: number; delay?: number } = {},
): string {
  const reduced = useReducedMotion();
  const mv = useMotionValue(0);
  const [text, setText] = useState(() => format(reduced ? target : 0));
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    if (reduced) {
      setText(formatRef.current(target));
      return;
    }
    const controls = animate(mv, target, {
      duration,
      delay,
      ease: EASE,
      onUpdate: (v) => setText(formatRef.current(v)),
    });
    return () => controls.stop();
  }, [reduced, target, duration, delay, mv]);

  return text;
}

/** A number that counts up in place on mount. */
export function CountUp({
  value,
  format,
  className,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
}) {
  const text = useCountUp(value, format);
  return <span className={className}>{text}</span>;
}
