/**
 * Telling "this does not exist" apart from "I could not ask".
 *
 *   npm test
 *
 * This is the single most dangerous judgement the read path makes, and it is
 * asymmetric on purpose. Only a positively identified refusal from the contract
 * may be called absence. Everything else is "the node did not answer".
 *
 * Being wrong in the safe direction shows a retry for a line that really is
 * missing, which is a mildly annoying page. Being wrong the other way tells a
 * reader their chronicle entry was deleted, serves a 404 that crawlers cache,
 * and does it because the network was busy for a second.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { NO_SUCH_LINE, errorText, saysNoSuchLine } from "../../lib/absence.ts";

const TAGGED = `[EXPECTED] ${NO_SUCH_LINE}`;
const B64 = Buffer.from(TAGGED).toString("base64");
const B64_TAGGED = Buffer.concat([
  Buffer.from([1]),
  Buffer.from(TAGGED),
]).toString("base64");

test("a plain contract refusal is absence", () => {
  assert.equal(saysNoSuchLine(`UserError: ${TAGGED}`), true);
});

test("a base64 refusal is absence", () => {
  assert.equal(saysNoSuchLine(`execution failed result=${B64}`), true);
});

test("a base64 refusal behind a result tag byte is absence", () => {
  assert.equal(saysNoSuchLine(`result=${B64_TAGGED}`), true);
});

test("the base64 scan does not swallow the key in front of it", () => {
  // The bug this pins: a character class of [A-Za-z0-9+/=]{16,} includes `=`
  // in the BODY, so the match starts one key=value pair early, decodes to
  // noise, and misses the refusal entirely.
  assert.equal(saysNoSuchLine(`somekey=${B64_TAGGED}`), true);
});

for (const [label, message] of [
  ["a rate limit", "unknown RPC error"],
  ["a missing contract", "Requested resource not found."],
  ["a dropped socket", "fetch failed ECONNRESET"],
  ["a timeout", "The operation was aborted due to timeout"],
  ["a different contract error", "UserError: [EXPECTED] you are out of energy for this cycle"],
]) {
  test(`${label} is NOT absence`, () => {
    assert.equal(saysNoSuchLine(message), false);
  });
}

/**
 * The shape a live Studio node actually returns, captured from the deployed
 * contract rather than invented.
 *
 * genlayer-js reports "Missing or invalid parameters" at the top level and puts
 * the contract's real answer in cause.data.receipt.result, base64, behind a one
 * byte tag. Searching only the message classed a genuinely missing line as
 * "unavailable", so the page offered a retry that could never succeed.
 */
const LIVE_REFUSAL = Object.assign(
  new Error(
    "Missing or invalid parameters. Double check you have provided the correct parameters.",
  ),
  {
    cause: {
      code: -32000,
      message: "execution failed",
      data: {
        receipt: {
          vote: null,
          execution_result: "ERROR",
          result: "AVtFWFBFQ1RFRF0gbm8gY2hyb25pY2xlIGxpbmUgd2l0aCB0aGF0IGluZGV4",
        },
      },
    },
  },
);

test("the top level message alone does NOT identify the refusal", () => {
  // Half of the pair. Without this the next test would pass even if the fix
  // were reverted, because the message might have carried the sentence anyway.
  assert.equal(saysNoSuchLine(String(LIVE_REFUSAL.message)), false);
});

test("the whole error DOES identify the refusal", () => {
  assert.equal(saysNoSuchLine(errorText(LIVE_REFUSAL)), true);
});

test("a live rate limit is still NOT absence once the whole error is read", () => {
  const rateLimited = Object.assign(new Error("unknown RPC error"), {
    cause: { code: -32603, message: "unknown RPC error", data: {} },
  });
  assert.equal(saysNoSuchLine(errorText(rateLimited)), false);
});

test("a circular error does not throw, and is not absence", () => {
  // Causes can link back, and a JSON.stringify that throws here would turn a
  // missing line into a 500.
  const circular = new Error("boom");
  circular.cause = { back: circular };
  assert.equal(saysNoSuchLine(errorText(circular)), false);
});

test("errorText survives things that are not errors at all", () => {
  for (const value of [null, undefined, 0, "", [], { a: 1 }]) {
    assert.equal(typeof errorText(value), "string");
    assert.equal(saysNoSuchLine(errorText(value)), false);
  }
});
