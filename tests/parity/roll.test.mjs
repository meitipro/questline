/**
 * The browser's arithmetic and the contract's must be the same arithmetic.
 *
 *   npm test
 *
 * Questline's whole claim is that a roll can be recomputed by anyone from
 * public data. /verify does that in the reader's browser using lib/roll.ts. If
 * that file disagrees with contracts/questline.py by one character, the page
 * tells honest readers their chronicle line was forged.
 *
 * So nothing here is written by hand. `contracts/test_helpers.py --json` prints
 * every answer the Python half gives, and this file re-derives all of them in
 * TypeScript and compares.
 *
 * Node 24 strips types from .ts on import, so the REAL module is under test
 * rather than a compiled copy of it. The previous version of this compiled the
 * lib to a temp directory first, which meant the thing being tested was never
 * quite the thing that shipped.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { rollSeed, sha256Hex, verifyRoll } from "../../lib/roll.ts";
import { bandCap, bandOf, normaliseStamp } from "../../lib/format.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

/** The Python half's answers, taken once. */
const REPORT = JSON.parse(
  execFileSync(
    process.platform === "win32" ? "python" : "python3",
    [join(ROOT, "contracts", "test_helpers.py"), "--json"],
    { encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } },
  ),
);

test("sha256 agrees with Python on known vectors", () => {
  assert.equal(sha256Hex("abc"), REPORT.vectors.abc);
  assert.equal(sha256Hex(""), REPORT.vectors.empty);
  // Pinned against the published vector too, so a matching pair of wrong
  // implementations cannot agree their way past this.
  assert.equal(
    sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("sha256 agrees with node:crypto across every padding boundary", () => {
  // lib/roll.ts implements sha256 by hand, because the browser's SubtleCrypto
  // is async and /verify recomputes inside a render. A hand written one is
  // wrong at the block boundary far more often than anywhere else: a naive
  // implementation passes "abc" and fails at 56 bytes, which is roughly the
  // length a real seed reaches. So every length either side of it is checked.
  for (let n = 0; n <= 130; n += 1) {
    const input = "q".repeat(n);
    assert.equal(
      sha256Hex(input),
      createHash("sha256").update(input, "utf8").digest("hex"),
      `sha256 differs at ${n} bytes`,
    );
  }
});

test("sha256 agrees on the exact shape of a real seed", () => {
  for (const row of REPORT.rolls) {
    assert.equal(
      sha256Hex(row.seed),
      createHash("sha256").update(row.seed, "utf8").digest("hex"),
    );
  }
});

test("the seed string is built the same way on both sides", () => {
  for (const row of REPORT.rolls) {
    assert.equal(
      rollSeed(row.at, row.who, row.index),
      row.seed,
      `seed differs for line ${row.index}`,
    );
  }
});

test("a mixed case address seeds the same roll as a lower case one", () => {
  // The contract lowercases before hashing. A JS half that does not produces a
  // different roll for the same line, and only for players whose wallet
  // happens to hand back a checksummed address.
  const mixed = "0xABCDEF0123456789abcdef0123456789ABCDEF01";
  assert.equal(
    verifyRoll("2026-06-15T12:00:00", mixed, 42),
    verifyRoll("2026-06-15T12:00:00", mixed.toLowerCase(), 42),
  );
});

test("every roll agrees with the contract", () => {
  for (const row of REPORT.rolls) {
    assert.equal(
      verifyRoll(row.at, row.who, row.index),
      row.roll,
      `roll differs for line ${row.index}`,
    );
  }
});

test("a roll is always inside the die", () => {
  for (const row of REPORT.rolls) {
    assert.ok(row.roll >= 1 && row.roll <= REPORT.constants.die);
  }
});

test("the band table agrees for every face of the die", () => {
  const { die, fail_max: failMax, partial_max: partialMax } = REPORT.constants;
  for (let roll = 1; roll <= die; roll += 1) {
    assert.equal(
      bandOf(roll, failMax, partialMax),
      REPORT.band_of[String(roll)],
      `band differs at ${roll}`,
    );
  }
});

test("the band of every computed roll agrees", () => {
  const { fail_max: failMax, partial_max: partialMax } = REPORT.constants;
  for (const row of REPORT.rolls) {
    assert.equal(bandOf(row.roll, failMax, partialMax), row.band);
  }
});

test("the magnitude cap each band imposes agrees", () => {
  for (const [band, cap] of Object.entries(REPORT.band_cap)) {
    assert.equal(bandCap(band, 4), cap, `cap differs for ${band}`);
  }
});

test("the middle band is never decorative", () => {
  // The property the cap exists to hold, checked across every region ceiling
  // rather than the single one the report samples.
  //
  // Note the shape: fail and success both get the full region ceiling, because
  // on a failure the magnitude is HARM. Only partial is halved, so that a
  // partial success landing the full magnitude cannot be mistaken for a
  // success. Asserting a rising fail < partial < success would be asserting
  // the opposite of the rule.
  for (let regionCap = 1; regionCap <= 8; regionCap += 1) {
    assert.equal(bandCap("fail", regionCap), regionCap);
    assert.equal(bandCap("success", regionCap), regionCap);
    assert.ok(
      bandCap("partial", regionCap) < regionCap || regionCap === 1,
      `partial should be under the ceiling at ${regionCap}`,
    );
    assert.ok(
      bandCap("partial", regionCap) >= 1,
      `partial should still do something at ${regionCap}`,
    );
  }
});

test("timestamp normalisation agrees on every shape storage can hold", () => {
  for (const [name, expected] of Object.entries(REPORT.stamps)) {
    const input = {
      bare: "2026-08-25T22:32:26",
      trailing_z: "2026-08-25T22:32:26Z",
      with_millis: "2026-08-25T22:32:26.123Z",
      padded: "  2026-08-25T22:32:26  ",
    }[name];
    assert.equal(normaliseStamp(input), expected, `normalise differs on ${name}`);
  }
});

test("the printed stamp and the stored stamp seed the same roll", () => {
  // The bug this pins, found on a live line: the page prints the timestamp with
  // a trailing Z and the seed is built from the stored form without one, so the
  // same line verified as 14 in storage and 6 in the browser.
  const stored = "2026-08-25T22:32:26";
  const printed = `${stored}Z`;
  const who = "0x88a1c4bb3f2e6d5a90b17c8e4f2d1a6b3c5e7f90";
  assert.equal(
    verifyRoll(normaliseStamp(printed), who, 88213),
    verifyRoll(stored, who, 88213),
  );
});
