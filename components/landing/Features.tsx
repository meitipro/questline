/**
 * The six promises, as a dashed grid of cells.
 *
 * The border trick: the container draws only its top and left edge, and every
 * cell draws its own right and bottom. That gives one hairline between
 * neighbours instead of two doubling up, and it survives the row count
 * changing when the grid reflows.
 */

import { FEATURES, FEATURES_INTRO } from "@/lib/landing";

export function Features() {
  return (
    <section id="features" style={{ position: "relative", background: "var(--ink)", borderTop: "1px solid var(--line)" }}>
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "88px clamp(20px, 3.4vw, 64px)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: "52ch" }}>
          <div className="eyebrow eyebrow-accent">{FEATURES_INTRO.eyebrow}</div>
          <h2
            style={{
              margin: "16px 0 0",
              fontSize: "clamp(30px, 3.4vw, 44px)",
              fontWeight: 700,
              letterSpacing: "-.035em",
              lineHeight: 1.05,
            }}
          >
            {FEATURES_INTRO.title}
          </h2>
          <p style={{ margin: "16px 0 0", fontSize: 18, lineHeight: 1.55, color: "var(--body)" }}>
            {FEATURES_INTRO.lede}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            // minmax(260px, 1fr) rather than a fixed count, so the row breaks
            // where the text stops fitting instead of at a guessed width.
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            marginTop: 44,
            borderTop: "1px dashed var(--line)",
            borderLeft: "1px dashed var(--line)",
          }}
        >
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className="feature-cell"
              style={{
                position: "relative",
                overflow: "hidden",
                padding: 26,
                borderRight: "1px dashed var(--line)",
                borderBottom: "1px dashed var(--line)",
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0.5,
                  pointerEvents: "none",
                  backgroundImage:
                    "linear-gradient(to right, var(--line) 1px, transparent 1px), linear-gradient(to bottom, var(--line) 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                  // The graph paper is strongest in the corner and gone by the
                  // middle, so it never competes with the words.
                  WebkitMask: "radial-gradient(farthest-side at top right, #000, transparent)",
                  mask: "radial-gradient(farthest-side at top right, #000, transparent)",
                }}
              />
              <div
                className="mono"
                style={{ position: "relative", fontSize: 12, letterSpacing: ".16em", color: "var(--accent-text)" }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3
                style={{
                  position: "relative",
                  margin: "34px 0 0",
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: "-.01em",
                }}
              >
                {feature.title}
              </h3>
              <p style={{ position: "relative", margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--muted)" }}>
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
