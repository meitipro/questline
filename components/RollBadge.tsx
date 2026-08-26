import { BAND_COLOR, BAND_LABEL, rollText } from "@/lib/format";
import type { Band } from "@/lib/types";

/**
 * The dice value and its band, always shown beside the outcome.
 *
 * "Always" is the design's word and it is the right one: the roll next to the
 * result is how the world proves it is not improvising in someone's favour, so
 * there is deliberately no variant of this component that hides the number.
 */
export function RollBadge({
  roll,
  band,
  die = 20,
  size = 12,
}: {
  roll: number;
  band: Band;
  die?: number;
  size?: 12 | 14 | 18;
}) {
  return (
    <>
      <span
        className="tag"
        style={{ fontSize: size, padding: size >= 18 ? "6px 12px" : "3px 8px" }}
      >
        {rollText(roll, die)}
      </span>
      <span
        className="mono"
        style={{ fontSize: size, color: BAND_COLOR[band] }}
      >
        {BAND_LABEL[band]}
      </span>
    </>
  );
}
