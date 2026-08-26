import Link from "next/link";

import { linePath, shortAddr } from "@/lib/format";
import type { Line } from "@/lib/types";

import { RollBadge } from "./RollBadge";
import { Sep } from "./Sep";

/**
 * One line of the chronicle: narration, effect, roll, player, rules version,
 * permalink. The design's component kit calls for exactly those six, and the
 * order matters - the narration is what makes a stranger read on, and the
 * evidence underneath it is what makes them believe it.
 *
 * `ago` is passed in rather than computed here. A relative time computed during
 * a server render and again during hydration produces two different strings and
 * React rightly complains, so the caller decides which clock it is using.
 */
export function ChronicleRow({
  line,
  ago,
  showAction = false,
}: {
  line: Line;
  ago: string;
  showAction?: boolean;
}) {
  return (
    <Link href={linePath(line.index)} className="feed-row">
      <div className="meta">
        <span style={{ color: "var(--cream)" }}>{shortAddr(line.who)}</span>
        <Sep />
        <span>{line.region_name}</span>
        <Sep />
        <span>rules v{line.rules_version}</span>
        <Sep />
        <span>{ago}</span>
      </div>

      {showAction ? (
        <div
          className="mono"
          style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}
        >
          {line.action}
        </div>
      ) : null}

      <div style={{ marginTop: 10, fontSize: 18, lineHeight: 1.55 }}>
        {line.text}
      </div>

      <div
        className="meta"
        style={{ marginTop: 12, alignItems: "center", gap: 10 }}
      >
        <RollBadge roll={line.roll} band={line.band} />
        <Sep />
        <span>{line.effect}</span>
        <Sep />
        <span>line {line.index}</span>
        {/* An undecided line is published like any other, because a world that
            hides its own failures is back to being a private server. */}
        {line.decided ? null : (
          <>
            <Sep />
            <span style={{ color: "var(--fail-text)" }}>undecided, energy refunded</span>
          </>
        )}
      </div>
    </Link>
  );
}
