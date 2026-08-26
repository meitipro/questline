import { untilShort } from "@/lib/format";
import type { Player } from "@/lib/types";

/**
 * Turns left, and the exact time the next cycle starts.
 *
 * "Exact" is doing work there. Out of energy is the most common refusal in the
 * game and the contract answers it with a timestamp rather than a vague later,
 * so the interface must not throw that precision away.
 */
export function EnergyMeter({
  player,
  nextCycleText,
  energy,
}: {
  player: Player;
  nextCycleText?: string;
  /**
   * The energy a turn would actually get, when the caller has worked it out.
   * A view method cannot roll the cycle forward, so the stored number can be a
   * cycle behind - see effectiveEnergy in lib/format.ts. Passed in rather than
   * computed here so the first paint matches on both sides of hydration.
   */
  energy?: number;
}) {
  const shown = energy ?? player.energy;

  const rows: [string, React.ReactNode][] = [
    ["health", `${player.health} of ${player.max_health}`],
    [
      "energy",
      // rows is a table of pairs, not a render list: the wrapper div in the
      // map below carries key={key}, and this is a single child of a span.
      // eslint-disable-next-line react/jsx-key -- not a list child
      <span style={{ color: "var(--accent-text)" }}>
        {shown} of {player.max_energy}
      </span>,
    ],
    [
      "next cycle",
      player.next_cycle
        ? nextCycleText ?? untilShort(player.next_cycle)
        : "on your first action",
    ],
    ["depth", String(player.depth)],
  ];

  return (
    <div className="panel pad-sm">
      <div className="label">CHARACTER</div>
      <div
        className="mono"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginTop: 16,
          fontSize: 14,
        }}
      >
        {rows.map(([key, value]) => (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ color: "var(--muted)" }}>{key}</span>
            <span style={{ textAlign: "right" }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
