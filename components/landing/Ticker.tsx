/**
 * The region marquee under the hero.
 *
 * The list is rendered TWICE and the animation travels -50%, so the second copy
 * is exactly where the first started when the loop restarts and the seam never
 * shows. Rendering it once and travelling -100% leaves a visible gap.
 *
 * The regions are the real ones from `get_world`, with their real rules
 * version, so this is a readout rather than decoration. A world with one region
 * shows one region.
 */

import type { World } from "@/lib/types";

export function Ticker({ regions }: { regions: World["regions"] }) {
  if (regions.length === 0) return null;

  const doubled = [...regions, ...regions];

  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        flex: "0 0 auto",
        width: "100%",
        padding: "0 0 30px",
        overflow: "hidden",
        // Fades both ends so items appear and leave rather than being clipped.
        WebkitMask: "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)",
        mask: "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)",
        animation: "ql-fade-up 1s cubic-bezier(.22,1,.36,1) .6s both",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 64,
          width: "max-content",
          animation: "ql-ticker 20s linear infinite",
        }}
      >
        {doubled.map((region, i) => (
          <span
            key={`${region.name}-${i}`}
            className="mono"
            // The second copy is the same words again, so it is hidden from
            // assistive technology rather than read out twice.
            aria-hidden={i >= regions.length}
            style={{
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
              height: 40,
              fontSize: 13,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "rgba(239,235,226,.62)",
              whiteSpace: "nowrap",
            }}
          >
            {region.name}
            {/* Punctuation, so it is hidden from assistive technology and
                allowed to sit under the contrast floor - the same rule the Sep
                component follows everywhere else. */}
            <span aria-hidden="true" style={{ color: "var(--dim)" }}>
              .
            </span>
            {/* The design has this at .42 alpha, which composites to 3.63:1 on
                the hero and fails AA. Raised to the lowest value that clears
                4.5 with room to spare (5.2:1), measured rather than guessed. */}
            <span style={{ color: "rgba(239,235,226,.56)" }}>rules v{region.rules_version}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
