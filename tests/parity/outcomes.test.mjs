/**
 * What the play console is allowed to resolve on its own.
 *
 *   npm test
 *
 * Before a deploy the console resolves a turn in the browser so the site is
 * complete and legible with no chain behind it. That demonstration is held to
 * the contract's rules rather than to a lower standard: a demo that granted a
 * sword on a roll of two would show the exact behaviour this product exists to
 * argue against, to the one audience most likely to be evaluating the claim.
 *
 * The rules themselves come from `contracts/test_helpers.py --json`, so tighten
 * FAIL_EFFECTS in the contract and this file starts failing without being
 * edited.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { LOCAL_RESULTS, REGISTRY } from "../../lib/outcomes.ts";
import { sampleChronicle, samplePlayer, sampleLeaderboard, sampleWorld } from "../../lib/sample.ts";
import { FEATURES, FAQS } from "../../lib/landing.ts";
import { effectiveEnergy } from "../../lib/format.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

const REPORT = JSON.parse(
  execFileSync(
    process.platform === "win32" ? "python" : "python3",
    [join(ROOT, "contracts", "test_helpers.py"), "--json"],
    { encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } },
  ),
);

const BANDS = ["fail", "partial", "success"];
const REGISTRY_NAMES = REGISTRY.map((item) => item.name);

test("the console knows the same three bands the contract does", () => {
  assert.deepEqual(Object.keys(LOCAL_RESULTS).sort(), [...BANDS].sort());
});

test("a failed roll may only do what the contract allows on a failure", () => {
  // The one that matters. FAIL_EFFECTS comes from the contract, so this cannot
  // drift into agreement by editing the test.
  for (const outcome of LOCAL_RESULTS.fail) {
    assert.ok(
      REPORT.constants.fail_effects.includes(outcome.effect),
      `a failed roll may not "${outcome.effect}"`,
    );
  }
});

test("every outcome names an effect the contract recognises", () => {
  for (const band of BANDS) {
    for (const outcome of LOCAL_RESULTS[band]) {
      assert.ok(
        REPORT.constants.effects.includes(outcome.effect),
        `${band}: "${outcome.effect}" is not an effect`,
      );
    }
  }
});

test("every item an outcome names is in the registry", () => {
  for (const band of BANDS) {
    for (const outcome of LOCAL_RESULTS[band]) {
      if (outcome.effect === "gain_item" || outcome.effect === "lose_item") {
        assert.ok(
          REGISTRY_NAMES.includes(outcome.target),
          `${band}: "${outcome.target}" is not a registry item`,
        );
      }
    }
  }
});

test("nothing moves state without naming what it moved", () => {
  for (const band of BANDS) {
    for (const outcome of LOCAL_RESULTS[band]) {
      if (outcome.effect !== "none") {
        assert.notEqual(outcome.target, "", `${band}: "${outcome.effect}" has no target`);
      }
    }
  }
});

test("no magnitude exceeds what the contract would allow", () => {
  for (const band of BANDS) {
    for (const outcome of LOCAL_RESULTS[band]) {
      assert.ok(outcome.magnitude >= 0, `${band}: negative magnitude`);
      assert.ok(
        outcome.magnitude <= REPORT.constants.die,
        `${band}: magnitude ${outcome.magnitude} is absurd`,
      );
    }
  }
});

test("each band keeps an outcome no inventory can rule out", () => {
  // The console filters this list to what is legal for the player before it
  // picks. If a band were left with nothing but item grants, a player already
  // holding those items would fall through to the no-effect placeholder every
  // single turn.
  for (const band of BANDS) {
    const alwaysLegal = LOCAL_RESULTS[band].filter(
      (o) => o.effect !== "gain_item" && o.effect !== "lose_item",
    );
    assert.ok(alwaysLegal.length > 0, `${band} has no unconditionally legal outcome`);
  }
});

test("every outcome carries narration", () => {
  for (const band of BANDS) {
    for (const outcome of LOCAL_RESULTS[band]) {
      assert.ok(outcome.text.trim().length > 0, `${band}: an outcome has no text`);
      assert.ok(
        outcome.text.split(/\s+/).length <= 60,
        `${band}: narration is over the contract's sixty word ceiling`,
      );
    }
  }
});

test("every published description of the seed names the same three fields", () => {
  // The landing told readers to hash "the action, the timestamp and the line
  // index". The contract hashes at | player | line index - the ACTION is not
  // in it and the PLAYER is. Anybody following the marketing copy would have
  // computed a different number and concluded the world was lying.
  //
  // /verify and /world were right, which is what made it survive: the wrong
  // sentence sat beside three correct ones.
  const describesSeed = [
    ...FEATURES.map((f) => f.body),
    ...FAQS.map((q) => q.answer),
  ].filter((text) => /seed(ed)?/i.test(text));

  assert.ok(describesSeed.length > 0, "nothing describes the seed any more");

  for (const text of describesSeed) {
    assert.match(text, /player/i, `does not name the player: ${text.slice(0, 60)}`);
    assert.match(text, /line index/i, `does not name the line index: ${text.slice(0, 60)}`);
    assert.doesNotMatch(
      text,
      /the action/i,
      `claims the action is in the seed, which it is not: ${text.slice(0, 60)}`
    );
  }
});

test("every seeded provenance points at a line that exists", () => {
  // A character sheet renders each carried item as a link to the line that
  // granted it, under the caption "Every item links to the action that granted
  // it". The seeded world is generated, so a provenance index that no seeded
  // line carries would put a 404 under that exact sentence, two clicks from
  // the landing page, in front of the audience most likely to be checking the
  // claim. Nothing in the generator enforces this on its own.
  const indexes = new Set(sampleChronicle().lines.map((l) => l.index));
  const board = sampleLeaderboard().rows;

  assert.ok(board.length > 0, "the seeded board is empty");

  for (const row of board) {
    const player = samplePlayer(row.address);
    for (const [item, at] of Object.entries(player.provenance ?? {})) {
      assert.ok(
        indexes.has(at),
        `${row.address.slice(0, 6)} carries "${item}" stamped ${at}, which is not a seeded line`
      );
    }
  }
});

test("no seeded player stands shallower than the region they start in", () => {
  // enter() floors every player at regions[0].depth, so a seeded depth below
  // that is a number the contract could not have produced - the site would be
  // publishing a state its own rules forbid. The generator picks depth and the
  // starting region independently, so only this test connects them.
  const world = sampleWorld();
  const floor = world.regions[0]?.depth ?? 0;

  for (const row of sampleLeaderboard().rows) {
    const player = samplePlayer(row.address);
    assert.ok(
      player.depth >= floor,
      `${row.address.slice(0, 6)} is at depth ${player.depth}, below the starting floor of ${floor}`
    );
  }
});

test("every seeded item carries a provenance, so the strong caption is true", () => {
  // The inventory panel prints "Every item links to the action that granted it"
  // only when every row actually links, and falls back to a weaker sentence
  // otherwise. In the seeded world it should never have to fall back: a
  // demonstration that cannot show its own central claim is not demonstrating
  // it. This is the invariant that keeps the strong caption honest.
  for (const row of sampleLeaderboard().rows) {
    const player = samplePlayer(row.address);
    for (const item of player.inventory) {
      assert.notEqual(
        player.provenance?.[item],
        undefined,
        `${row.address.slice(0, 6)} carries "${item}" with no line to link to`
      );
    }
  }
});

test("every seeded item a player carries is in the registry", () => {
  const registry = new Set(REGISTRY.map((i) => i.name));
  for (const row of sampleLeaderboard().rows) {
    for (const item of samplePlayer(row.address).inventory) {
      assert.ok(registry.has(item), `"${item}" is carried but is not in the registry`);
    }
  }
});

test("a cycle that has already turned reads as a full energy bar", () => {
  const past = new Date(Date.now() - 60_000).toISOString().slice(0, 19);
  const future = new Date(Date.now() + 3_600_000).toISOString().slice(0, 19);

  assert.equal(effectiveEnergy({ energy: 0, max_energy: 5, next_cycle: past }), 5);
  assert.equal(effectiveEnergy({ energy: 0, max_energy: 5, next_cycle: future }), 0);
  assert.equal(effectiveEnergy({ energy: 2, max_energy: 5, next_cycle: future }), 2);
  // No cycle recorded means the player has never acted, so the bar is full.
  assert.equal(effectiveEnergy({ energy: 0, max_energy: 5, next_cycle: "" }), 5);
});
