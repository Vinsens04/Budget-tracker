"use client";

import { useEffect, useState } from "react";
import { useMotionValueEvent, useReducedMotion, useSpring } from "motion/react";
import { money } from "@/lib/finance";

/** Retarget from the current value when another transaction arrives. */
export function AnimatedAmount({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const spring = useSpring(value, { stiffness: 170, damping: 27, mass: 0.7 });
  const [display, setDisplay] = useState(value);
  useMotionValueEvent(spring, "change", (next) => setDisplay(next));
  useEffect(() => {
    if (reduced) {
      spring.jump(value);
      setDisplay(value);
    } else spring.set(value);
  }, [value, reduced, spring]);
  return (
    <span className="animated-amount" aria-label={money(value)}>
      <span aria-hidden="true">{money(Math.round(display))}</span>
    </span>
  );
}
