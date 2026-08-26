/**
 * The world's item registry, and the outcomes the console may resolve locally.
 *
 * A LEAF MODULE ON PURPOSE. It imports nothing but types, so tests/parity can
 * import it directly under `node --test` - Node strips the types and resolves
 * no siblings. lib/sample.ts pulls both tables from here rather than owning
 * them, because a module that imports lib/format.ts cannot be loaded that way
 * and these two tables are exactly the ones worth pinning against the contract.
 *
 * The registry is a world RULE, not sample decoration: it is the list the
 * contract checks a granted item against, and an outcome naming something
 * outside it degrades to no effect on chain and here alike.
 */

import type { Line } from "./types";

export const REGISTRY: { name: string; note: string }[] = [
  { name: "rusted bar", note: "bends under load, opens what hands cannot" },
  { name: "torn page", note: "half a rule from a version nobody kept" },
  { name: "lantern, wet", note: "lights on the third try, or the fourth" },
  { name: "brass key", note: "warmer than the water around it" },
  { name: "salt rope", note: "sings before it fails, which is a courtesy" },
  { name: "tin whistle", note: "opens shutters that are not near you" },
  { name: "ledger fragment", note: "a column of numbers and no header" },
  { name: "glass float", note: "someone has written a number inside it in salt" },
  { name: "ferryman token", note: "passage for one, once, in one direction" },
  { name: "a number in salt", note: "not yours, and it knows it" },
];

/**
 * Outcomes the console uses when it plays a turn locally, before a deploy.
 *
 * Grouped by band because the band is the one thing a local turn must not get
 * wrong: a failure that granted an item would demonstrate the opposite of what
 * this product claims. Each entry is legal under the contract's own rules - no
 * grants or moves in the fail group, and every named item is in the registry.
 */
export const LOCAL_RESULTS: Record<
  "fail" | "partial" | "success",
  { text: string; effect: Line["effect"]; target: string; magnitude: number }[]
> = {
  fail: [
    { text: "you push, and the archive pushes back. water closes over the shelf you were holding.", effect: "damage", target: "self", magnitude: 3 },
    { text: "nothing gives. you lose your footing and the cold takes what was left of your grip.", effect: "damage", target: "self", magnitude: 2 },
    { text: "the movement is wrong from the start. whatever you were holding is in the water now.", effect: "lose_item", target: "torn page", magnitude: 1 },
  ],
  partial: [
    { text: "it half works. something shifts, something else settles back into place, and you are no further in.", effect: "none", target: "", magnitude: 0 },
    { text: "the movement is right and the timing is not. you gain a torn page and lose the light for a moment.", effect: "gain_item", target: "torn page", magnitude: 2 },
    { text: "you get most of the way. it is far enough to see the second landing, and not far enough to reach it.", effect: "discover", target: "the second landing", magnitude: 2 },
  ],
  success: [
    { text: "it works, quietly. the archive does not comment. you take the brass key and it is warmer than the water.", effect: "gain_item", target: "brass key", magnitude: 3 },
    { text: "the way opens by an inch and then by a foot. you step through onto the long stair.", effect: "move", target: "the long stair", magnitude: 4 },
    { text: "the seal gives. behind it is a room the map does not have, and it is dry.", effect: "discover", target: "a dry room", magnitude: 4 },
  ],
};
