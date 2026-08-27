"use client";

/**
 * Four counter-rotating rings with player chips riding them, around a live count.
 *
 * The geometry is the design's and is kept in its own coordinate space: every
 * ring, offset and chip position below is measured against an 797px box, and
 * the whole assembly is then scaled by a single transform. Re-deriving these
 * numbers for the actual viewport would mean re-deriving eight chip positions
 * every resize, and the arithmetic that keeps a chip centred on its ring
 * (`rotate(a) translate(r) rotate(-a)`) only stays exact in one fixed space.
 *
 * Each chip counter-rotates against its own ring at the same period, which is
 * what keeps the text upright while the ring turns underneath it.
 */

import { useEffect, useState } from "react";

import { ORBIT_BOX, ORBIT_CHIPS, ORBIT_RINGS } from "@/lib/landing";

/**
 * How much of the design's 797px box actually fits here.
 *
 * Ported from the design's own resize handler rather than replaced with a
 * media query, because it fits against BOTH axes: a short landscape window
 * needs the rings smaller even though it is wide, and a media query on width
 * alone lets them run off the bottom.
 */
function fitScale(w: number, h: number): number {
  const byWidth = w <= 480 ? 0.4 : w <= 768 ? 0.5 : w <= 1024 ? 0.7 : w <= 1280 ? 0.85 : 1;
  const pad = Math.min(64, Math.max(20, w * 0.034));
  const contentW = w - pad * 2;
  const sideBox = contentW - 24 - 360;
  const stacked = sideBox < 300;
  const fitW = Math.min(1, (stacked ? contentW : sideBox) / ORBIT_BOX);
  const fitH = Math.min(1, (h - (stacked ? 390 : 300)) / ORBIT_BOX);
  return Math.max(0.32, Math.min(byWidth, fitW, fitH));
}

/** The gradient hairline every ring is drawn with. */
const RING_EDGE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: "50%",
  padding: 1,
  background:
    "linear-gradient(180deg, rgba(233,162,59,0) 0%, rgba(233,162,59,1) 43%, rgba(233,162,59,0) 100%)",
  // Masked to the padding box, which leaves only the 1px edge painted.
  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  WebkitMaskComposite: "xor",
  maskComposite: "exclude",
  pointerEvents: "none",
};

export function OrbitRings({
  players,
  resolved,
}: {
  /** Read from the chain by the page, counted up to here. */
  players: number;
  resolved: number;
}) {
  const [scale, setScale] = useState(1);
  const [count, setCount] = useState(players);

  useEffect(() => {
    const measure = () => setScale(fitScale(window.innerWidth, window.innerHeight));
    measure();
    // The design measures again after layout settles; a first read during font
    // swap can be a hundred pixels short and leaves the rings undersized.
    const settle = setTimeout(measure, 400);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(settle);
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    // The count starts AT the real number, and the animation is something this
    // effect opts into. That ordering is the whole point:
    // requestAnimationFrame does not fire in a hidden tab, so a page opened in
    // the background with the old "start at zero and animate up" shape sat on
    // 0 PLAYERS until somebody focused it. On a product whose argument is that
    // it never shows a number it cannot support, inventing a zero is the worst
    // available failure. Measured, not theorised: the counter read 0 in a
    // backgrounded tab.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (still.matches || document.hidden) return;

    setCount(0);
    let raf = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;

    const begin = setTimeout(() => {
      const from = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - from) / 2000);
        // Cubic ease out: fast at first, so the number reads as settling on a
        // real value rather than counting evenly like an odometer.
        setCount(Math.round(players * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      // And a belt for the braces: if the tab is hidden between here and the
      // first frame, the animation never starts and this lands the real number
      // anyway. Harmless when the animation did run - it is already there.
      settle = setTimeout(() => setCount(players), 2400);
    }, 1200);

    return () => {
      clearTimeout(begin);
      if (settle) clearTimeout(settle);
      cancelAnimationFrame(raf);
    };
  }, [players]);

  const box = Math.round(ORBIT_BOX * scale);
  const inset = Math.round(38.5 * scale);

  return (
    <div
      aria-hidden="true"
      style={{
        flex: "0 0 auto",
        position: "relative",
        width: box,
        height: box,
        animation: "ql-scale-in 1.2s cubic-bezier(.22,1,.36,1) .3s both",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: inset,
          top: inset,
          width: 720,
          height: 720,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
        }}
      >
        {ORBIT_RINGS.map((ring, index) => (
          <div
            key={ring.size}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: ring.size,
              height: ring.size,
              margin: `${-ring.size / 2}px 0 0 ${-ring.size / 2}px`,
              borderRadius: "50%",
              animation: `ql-spin-${ring.spin} ${ring.seconds}s linear infinite`,
            }}
          >
            <div style={RING_EDGE} />

            {index === 0 ? (
              // The counter rides the innermost ring, spun the opposite way so
              // it stays still while the ring turns under it.
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  animation: `ql-spin-${ring.spin === "l" ? "r" : "l"} ${ring.seconds}s linear infinite`,
                }}
              >
                <div style={{ display: "grid", placeItems: "center", gap: 4, textAlign: "center" }}>
                  <span
                    style={{
                      fontSize: 64,
                      fontWeight: 700,
                      lineHeight: 1,
                      letterSpacing: "-.04em",
                      color: "#efebe2",
                    }}
                  >
                    {count.toLocaleString("en-US")}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      letterSpacing: ".16em",
                      color: "rgba(239,235,226,.74)",
                      textIndent: ".16em",
                    }}
                  >
                    PLAYERS
                  </span>
                  <span
                    className="mono"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 8,
                      fontSize: 12,
                      letterSpacing: ".14em",
                      color: "#e9a23b",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--accent)",
                        animation: "ql-pulse 1.8s infinite",
                      }}
                    />
                    {resolved.toLocaleString("en-US")} RESOLVED
                  </span>
                </div>
              </div>
            ) : null}

            {ORBIT_CHIPS.filter((chip) => chip.ring === index).map((chip) => (
              <div
                key={chip.who + chip.angle}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  // Rotate to the angle, push out by the radius, then rotate
                  // back so the chip itself stays level.
                  transform: `translate(-50%,-50%) rotate(${chip.angle}deg) translate(${ring.size / 2}px) rotate(${-chip.angle}deg)`,
                }}
              >
                <div style={{ animation: `ql-fly-in .9s cubic-bezier(.22,1,.36,1) ${chip.delay}s both` }}>
                  <div
                    className="mono"
                    style={{
                      animation: `ql-spin-${ring.spin === "l" ? "r" : "l"} ${ring.seconds}s linear infinite`,
                      display: chip.detail ? "grid" : "flex",
                      alignItems: "center",
                      gap: chip.detail ? 5 : undefined,
                      padding: chip.detail ? "13px 15px" : "9px 13px",
                      border: `1px solid var(--${chip.accent ? "accent" : "line"})`,
                      background: chip.accent ? "rgba(233,162,59,.14)" : "var(--panel)",
                      whiteSpace: "nowrap",
                      boxShadow: "0 0 28px rgba(233,162,59,.32)",
                    }}
                  >
                    <span style={{ fontSize: chip.detail ? 14 : 13, color: "var(--cream)" }}>
                      {chip.who}
                    </span>
                    {chip.detail ? (
                      <span style={{ fontSize: 11, letterSpacing: ".14em", color: "var(--muted)" }}>
                        {chip.detail}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
