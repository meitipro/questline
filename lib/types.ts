// The shapes the contract's view methods return. Every view answers with a json
// string, so these are the parsed forms and they are the only place the app
// describes chain state.

export type Band = "fail" | "partial" | "success";

export type Effect =
  | "none"
  | "damage"
  | "heal"
  | "gain_item"
  | "lose_item"
  | "move"
  | "discover";

export interface Line {
  index: number;
  who: string;
  /** What the player typed, after the contract cleaned it. */
  action: string;
  /** The narration the validators agreed on. */
  text: string;
  effect: Effect;
  target: string;
  magnitude: number;
  /** The region's own ceiling. */
  region_cap: number;
  /** The ceiling that actually applied, after the dice band narrowed it. */
  band_cap: number;
  roll: number;
  band: Band;
  region: number;
  region_name: string;
  rules_version: number;
  /** Inventory as it stood when the model was asked. */
  inventory: string;
  at: string;
  /**
   * False when the criteria were not met. The line is still published, no state
   * moved, and the energy was refunded.
   */
  decided: boolean;
}

export interface Region {
  index: number;
  name: string;
  description: string;
  rules: string;
  rules_version: number;
  max_magnitude: number;
  depth: number;
  exits: string[];
}

export interface RegistryItem {
  name: string;
  note: string;
}

export interface Season {
  number: number;
  name: string;
  ends: string;
  /** wei, as a string, because a pool outgrows Number.MAX_SAFE_INTEGER. */
  pool: string;
  closed: boolean;
  pass_price: string;
  mint_price: string;
}

export interface WorldRules {
  die: number;
  fail_max: number;
  partial_max: number;
  max_energy: number;
  cycle_hours: number;
  max_health: number;
  effects: Effect[];
  fail_effects: Effect[];
  seed: string;
}

export interface World {
  owner: string;
  regions: Region[];
  registry: RegistryItem[];
  rules: WorldRules;
  /**
   * The exact task and criteria the validators were handed. Read from the
   * contract rather than restated here, so /world cannot show a paraphrase that
   * has drifted from what actually adjudicates an action.
   */
  adjudication: { task: string; criteria: string[] };
  season: Season;
  counts: { players: number; actions: number; regions: number; items: number };
}

export interface Player {
  address: string;
  exists: boolean;
  region: number;
  region_name: string;
  energy: number;
  max_energy: number;
  health: number;
  max_health: number;
  inventory: string[];
  cycle_started: string;
  next_cycle: string;
  joined: string;
  actions: number;
  best_roll: number;
  depth: number;
  ranked: boolean;
  rank: number;
  /** item name -> the chronicle line index that granted it. */
  provenance: Record<string, number>;
}

export interface ChroniclePage {
  total: number;
  next: number;
  more: boolean;
  lines: Line[];
}

export interface LeaderRow {
  rank: number;
  address: string;
  actions: number;
  depth: number;
  best_roll: number;
}

export interface PastSeason {
  number: number;
  name: string;
  pool: string;
  winner: string;
  closed_at: string;
}

export interface Leaderboard {
  season: Pick<Season, "number" | "name" | "ends" | "pool" | "closed">;
  rows: LeaderRow[];
  past: PastSeason[];
}

/**
 * A write takes longer than a token transfer, so the stage is part of the
 * interface rather than a spinner. The copy for each one lives in
 * components/ActionConsole.tsx.
 */
export type WriteStage =
  | "idle"
  | "signing"
  | "sent"
  | "accepted"
  | "finalized"
  | "failed";
