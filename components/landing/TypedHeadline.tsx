"use client";

/**
 * The headline, typed one character at a time in two colours.
 *
 * Three things this has to get right beyond the animation itself:
 *
 *  1. THE WORDS MUST EXIST WITHOUT JAVASCRIPT. The animated spans start empty
 *     on the server, so the real sentence is rendered beside them in a
 *     screen-reader-only span. A crawler and a screen reader both get the whole
 *     headline; the animated copy is aria-hidden so it is never read twice.
 *  2. REDUCED MOTION SKIPS IT. Somebody who has asked for less movement gets
 *     the finished sentence on the first frame rather than a fast version of
 *     the same effect.
 *  3. THE BOX DOES NOT GROW. `min-height` holds two lines from the start, so
 *     the lede and the buttons below do not get pushed down as it types.
 */

import { useEffect, useState } from "react";

import { HEADLINE } from "@/lib/landing";

export function TypedHeadline() {
  const full = HEADLINE.dark + HEADLINE.light;

  // Starts at 0 on both sides of hydration, so there is no mismatch and no
  // flash of the finished sentence before the animation begins.
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (still.matches) {
      setTyped(full.length);
      return;
    }

    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        setTyped((n) => {
          if (n >= full.length) {
            if (interval) clearInterval(interval);
            return n;
          }
          return n + 1;
        });
      }, HEADLINE.speed);
    }, HEADLINE.delay);

    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [full.length]);

  const dark = HEADLINE.dark.slice(0, Math.min(typed, HEADLINE.dark.length));
  const light =
    typed > HEADLINE.dark.length
      ? HEADLINE.light.slice(0, typed - HEADLINE.dark.length)
      : "";
  const typing = typed < full.length;

  return (
    <h1
      style={{
        margin: 0,
        fontSize: "clamp(28px, 4.2vw, 64px)",
        fontWeight: 700,
        lineHeight: 1.0,
        letterSpacing: "-.045em",
        textWrap: "pretty",
        minHeight: "2.1em",
      }}
    >
      <span className="sr-only">{full}</span>
      {/* The hero is dark in BOTH themes - the gradient behind it does not
          respond to the theme - so these two are fixed rather than tokens:
          --cream would turn near-black in light mode and vanish.

          The recessive half was #0a0b0c, which is the design's "ink pressed
          into the page" over a photograph. There is no photograph here: the
          hero is a gradient running from #1b1d22 down to #0a0b0c, so the first
          half of the headline was ink on ink at 1.0:1 - the sentence carrying
          this product's entire claim was invisible, on the live site, in both
          themes. Measured, not inferred.

          #6f6b61 keeps the two-tone reading - one half recedes, one half is
          bright - at 3.2:1 against the LIGHTEST point of the gradient, which is
          the worst case for a mid grey. If the design's photograph is ever
          added, this can go back to ink and be measured against the image. */}
      <span aria-hidden="true" style={{ color: "#6f6b61" }}>
        {dark}
      </span>
      <span aria-hidden="true" style={{ color: "#efebe2" }}>
        {light}
      </span>
      {typing ? (
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 3,
            height: ".82em",
            marginLeft: 4,
            verticalAlign: "baseline",
            background: "var(--accent)",
            animation: "ql-blink 1s step-end infinite",
          }}
        />
      ) : null}
    </h1>
  );
}
