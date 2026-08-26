"use client";

import { useEffect, useState } from "react";

import { countdown } from "@/lib/format";

/**
 * The season clock, and the appeal window when there is one.
 *
 * The design chapter is explicit that a window has to be a countdown and not a
 * date buried in a tooltip, so this ticks. It renders the server's string first
 * and only starts ticking after mount, which keeps the first paint identical on
 * both sides.
 */
export function Countdown({ ends, initial }: { ends: string; initial: string }) {
  const [text, setText] = useState(initial);

  useEffect(() => {
    const tick = () => setText(countdown(ends));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [ends]);

  return <>{text}</>;
}
