/**
 * The agreement count, checked against a real receipt.
 *
 *   npm test
 *
 * This one number is the product's entire argument rendered as text: several
 * strangers resolved your action independently and had to agree. It has been
 * wrong in both directions already, so it is pinned here in both directions.
 *
 * The fixture below is not invented. It is the `consensus_data` read off a real
 * Studio transaction - 0xbed5dbc0776eb194d55c32ae5bed026dab83a83437fd2b0d12b614c315d22f76
 * on 0x54D2A2457655AB117eb8823d206d2C92c2B6CeB1 - for an action that resolved
 * successfully and was written to the chronicle.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { describeVotes } from "../../lib/actions.ts";

/**
 * A REAL receipt for a successfully resolved action.
 *
 * Note the two sources disagree on how many validators there were: four entries
 * in `validators`, five in `votes`. So the denominator can never be "however
 * many the receipt lists" - it has to be the number of votes actually cast.
 */
const REAL = {
  consensus_data: {
    validators: [
      { mode: "validator", vote: "agree" },
      { mode: "validator", vote: "agree" },
      { mode: "validator", vote: "agree" },
      { mode: "validator", vote: "idle" },
    ],
    votes: {
      "0x4DcAE2871cAc82dA355C4656ee2b7EF1Af52C40c": "idle",
      "0xA243FDBe37a36402c0F38Ee9E5D0E4a3b60a17D7": "idle",
      "0xDCEff558739d64A8BabaeeC882B3e8808e9BDb0A": "agree",
      "0xF9ce48dc10ebA96080a5D25dab7DE36CcA26146E": "agree",
      "0xc699a9aaE3Af1feF509931aCc94cC8c58dc1f7f7": "agree",
    },
  },
};

test("an idle validator is not a dissenter", () => {
  // This printed "3 of 4" - which tells a reader that one of four strangers
  // looked at the action and disagreed. None did. One did not answer.
  assert.equal(describeVotes(REAL), "3 of 3");
});

test("a real disagreement is still counted", () => {
  // The fix must not achieve honesty by never reporting a split.
  assert.equal(
    describeVotes({ consensus_data: { validators: [{ vote: "agree" }, { vote: "agree" }, { vote: "disagree" }] } }),
    "2 of 3"
  );
});

test("disagree is never read as agreement", () => {
  // "disagree".includes("agree") is true, and a substring match here once
  // rendered a two of five split as "5 of 5" in the affirmative colour.
  assert.equal(
    describeVotes({ consensus_data: { validators: [{ vote: "disagree" }, { vote: "disagree" }] } }),
    "0 of 2"
  );
});

test("a vote vocabulary this build does not know produces no row", () => {
  // The dangerous failure is confidently printing "0 of 5" on an action that
  // reached consensus, so an unrecognised word counts on neither side and an
  // all-unrecognised receipt reports nothing at all.
  assert.equal(describeVotes({ consensus_data: { validators: [{ vote: "weltschmerz" }] } }), undefined);
  assert.equal(describeVotes({ consensus_data: { validators: [{ vote: "idle" }, { vote: "idle" }] } }), undefined);
});

test("a receipt with no votes reports nothing rather than zero", () => {
  assert.equal(describeVotes({}), undefined);
  assert.equal(describeVotes({ consensus_data: {} }), undefined);
  assert.equal(describeVotes(null), undefined);
});

test("the votes object is read when the validators array is absent", () => {
  // Same receipt, other source: three agreements among five listed, two idle.
  assert.equal(describeVotes({ consensus_data: { votes: REAL.consensus_data.votes } }), "3 of 3");
});
