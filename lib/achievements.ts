import type { Player, World } from "./types";

/**
 * Achievements, derived rather than stored.
 *
 * Nothing here is a flag an operator sets. Each one is a statement about public
 * state that any reader can check against the same view methods this page used,
 * and each carries the sentence that says how it was measured - because an
 * achievement whose rule is private is just a badge somebody handed out.
 *
 * There are deliberately no holder counts. Counting holders would mean walking
 * every player in the roster on every page view, or keeping a tally the operator
 * maintains, and the second one is exactly the kind of number this product has
 * no business asking anyone to trust.
 */
export interface Achievement {
  name: string;
  body: string;
  /** What was measured, so the claim can be checked. */
  measure: string;
  held: boolean;
}

export function achievementsFor(player: Player, world: World): Achievement[] {
  const deepest = world.regions.reduce((max, r) => Math.max(max, r.depth), 0);
  const registrySize = world.registry.length;

  return [
    {
      name: "Natural twenty",
      body: "Resolve an action on a roll of twenty.",
      measure: `best roll ${player.best_roll} of ${world.rules.die}`,
      held: player.best_roll >= world.rules.die,
    },
    {
      name: "Read the archive aloud",
      // The rule named a `discover` effect, and no discover has ever granted
      // an item: `gain_item` is the only effect in the contract that appends to
      // an inventory. The measure was worse - it counted registry items carried
      // while the badge tested for one specific item, so two players could read
      // the identical sentence and get opposite badges.
      body: "Carry the torn page, which a resolved action granted through a gain_item effect.",
      measure: player.inventory.includes("torn page")
        ? "the torn page is in your inventory"
        : `not carried . ${player.inventory.length} of ${registrySize} registry items held`,
      held: player.inventory.includes("torn page"),
    },
    {
      name: "Cartographer",
      body: "Stand in the deepest region the world has.",
      measure: `depth ${player.depth} of ${deepest}`,
      held: deepest > 0 && player.depth >= deepest,
    },
    {
      name: "A hundred turns",
      body: "One hundred resolved actions in this world.",
      measure: `${player.actions} resolved`,
      held: player.actions >= 100,
    },
    {
      name: "Ranked",
      body: "Hold a season pass, and a placing worth arguing about.",
      measure: player.ranked
        ? `rank ${player.rank || "unplaced"}`
        : "no pass for this season",
      held: player.ranked,
    },
  ];
}

/**
 * The definitions, without a player. Used on /season, where the job is to make
 * the rules legible rather than to say who holds what.
 */
export function achievementDefinitions(world: World): Omit<Achievement, "held" | "measure">[] {
  const deepest = world.regions.reduce((max, r) => Math.max(max, r.depth), 0);
  return [
    {
      name: "Natural twenty",
      body: `Resolve an action on a roll of ${world.rules.die}. Checked against best_roll in contract storage.`,
    },
    {
      name: "Read the archive aloud",
      body: "Carry the torn page. Only a gain_item effect appends to an inventory, so the badge is a fact about contract storage rather than a claim.",
    },
    {
      name: "Cartographer",
      body: `Reach depth ${deepest}, the deepest region published. Checked against depth in contract storage.`,
    },
    {
      name: "A hundred turns",
      body: "One hundred resolved actions. A rotated or undecided action does not count, because it never spent energy.",
    },
    {
      name: "Ranked",
      body: "Hold a season pass. Placings settle on finality, not acceptance.",
    },
  ];
}
