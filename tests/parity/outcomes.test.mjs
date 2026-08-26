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

test("a cycle that has already turned reads as a full energy bar", () => {
  const past = new Date(Date.now() - 60_000).toISOString().slice(0, 19);
  const future = new Date(Date.now() + 3_600_000).toISOString().slice(0, 19);

  assert.equal(effectiveEnergy({ energy: 0, max_energy: 5, next_cycle: past }), 5);
  assert.equal(effectiveEnergy({ energy: 0, max_energy: 5, next_cycle: future }), 0);
  assert.equal(effectiveEnergy({ energy: 2, max_energy: 5, next_cycle: future }), 2);
  // No cycle recorded means the player has never acted, so the bar is full.
  assert.equal(effectiveEnergy({ energy: 0, max_energy: 5, next_cycle: "" }), 5);
});
