/**
 * Whether /play offers "Enter the world", "Act", or neither yet.
 *
 *   npm test
 *
 * Found by the owner's first real wallet on their own contract: connected,
 * never entered, and the console offered Act while the panel beside it said to
 * enter the world. The shapes below are what /api/player returns - the Read
 * from lib/contract.ts spread at the top level, plus the chronicle lines.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { entryFrom } from "../../lib/entry.ts";

const ADDR = "0x1111111111111111111111111111111111111111";

test("the contract saying exists:false is what offers Enter", () => {
  assert.equal(
    entryFrom({ data: { address: ADDR, exists: false }, live: true, lines: [] }),
    "absent"
  );
});

test("a character that exists has entered", () => {
  assert.equal(
    entryFrom({ data: { address: ADDR, exists: true, inventory: [] }, live: true, lines: [] }),
    "entered"
  );
});

test("a read the node did not answer says nothing about entry", () => {
  // The unavailable payload is the SEEDED character, which exists. Reading it
  // as entered would hand a connected wallet somebody else's inventory, and
  // reading it as absent would offer Enter on a claim the chain never made.
  assert.equal(
    entryFrom({ data: { address: ADDR, exists: true }, live: false, status: "unavailable", lines: [] }),
    "unknown"
  );
  assert.equal(
    entryFrom({ data: { address: ADDR, exists: false }, live: false, status: "unavailable" }),
    "unknown"
  );
});

test("nothing, or something unreadable, is not absence", () => {
  const unreadable = [
    undefined,
    null,
    "",
    0,
    {},
    { data: null },
    { data: {} },
    { data: { exists: "false" } },
    { data: { exists: 0 } },
  ];
  for (const blob of unreadable) {
    assert.equal(entryFrom(blob), "unknown", JSON.stringify(blob));
  }
});
