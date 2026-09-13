/**
 * Whether a player read says this address has entered the world.
 *
 * Three answers, not two, because "no character on screen" covers three
 * different facts: the contract said this address never entered, the contract
 * has not answered yet, or it did not answer at all. Only the first may offer
 * "Enter the world". Offering it on a failed read would be a claim the chain
 * never made.
 *
 * Offering "Act" on a positive absence is the bug this replaced. /play read
 * `player?.exists === false` off a player that is never set for an absent
 * address, so every first-time wallet was offered Act, while the panel beside
 * it said to enter the world. Found by the owner's first real wallet.
 *
 * A leaf module, free of React and genlayer-js, so the parity tests import it
 * directly.
 */

export type Entry = "unknown" | "entered" | "absent";

/** Pass it the body /api/player returns: the Read spread at the top level. */
export function entryFrom(blob: unknown): Entry {
  if (!blob || typeof blob !== "object") return "unknown";
  const read = blob as { status?: unknown; data?: { exists?: unknown } | null };
  /* The node did not answer, and the payload is the seeded character rather
   * than this one - which says nothing about whether this address entered. */
  if (read.status === "unavailable") return "unknown";
  if (read.data?.exists === true) return "entered";
  if (read.data?.exists === false) return "absent";
  return "unknown";
}
