<div align="center">

# Questline

**The game master is a contract.**

A persistent text world where the rules, the rolls and your inventory live on
chain. Players type what they do, validators resolve it against rules anyone can
read, and every resolved action becomes a public chronicle line with its dice
roll attached.

[![Built by InferNode](https://img.shields.io/badge/built%20by-InferNode-7ac943?style=flat-square)](https://github.com/meitipro)
[![GenLayer](https://img.shields.io/badge/GenLayer-Intelligent%20Contract-101216?style=flat-square)](https://genlayer.com)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-101216?style=flat-square)](https://nextjs.org)
[![MIT](https://img.shields.io/badge/license-MIT-101216?style=flat-square)](LICENSE)

[www.questline.world](https://www.questline.world)

</div>

## Overview

    contract   contracts/questline.py     GenVM Python SDK
    network    GenLayer Studio            chain 61999, flip with one env var
    site       Next.js 14 App Router      port 3400

Nobody here can cheat, and that includes the people who built it. The operator
cannot mint an item, cannot reroll a loss, and cannot change what a rule said
after you played by it. Every claim on that list is something a reader can check
rather than take on trust, which is what the rest of this file is about.

## How it works

Everything is arranged around one division of labour, and `act()` is written to
be read in three parts:

    the deterministic half decides what is POSSIBLE
    the model decides what HAPPENS inside that box
    the deterministic half applies the caps the model cannot exceed

The model narrates. The code decides. That division is what makes the world safe
to leave running, which is why the interesting checks all sit either side of the
nondeterministic block rather than inside it.

A turn looks like this:

1. You type an action. The contract reads your region, its published rules, what
   you carry, the legal exits and the item registry.
2. It rolls, deterministically, from data that is already public.
3. Several validators each resolve the action independently against the same
   evidence, and have to agree on what it changed.
4. The caps are applied to whatever they agreed. The line is published either
   way, with the roll, the rules version and your inventory at the time.

## Why this needs GenLayer

A text world needs a referee that can read a sentence. That is a model, and a
model on an ordinary chain is a server somebody owns.

The obvious design is to let validators grade the leader: show them the answer
and ask whether it is permissible. That does not work here, and the reason is
the whole argument for this contract. Grading only asks "is this A permissible
resolution", and for almost any action several are. A leader that always chose
the most generous legal outcome would pass every grading and still be robbing
the world, because no other node ever forms an opinion of its own.

So `act` uses `gl.vm.run_nondet` with a validator that **resolves the action
itself** and compares the state change rather than the prose. Two correct models
never write the same sentence, so comparing narration under equality is the
reliable way to make honest validators disagree. What must match is what moved:

- `none` and `discover` collapse to "nothing", because neither moves state
- `damage` and `heal` carry no target, because the target is always the player
- magnitude is clamped to the band ceiling first, then compared with a tolerance
  of one, which is a difference of degree the region cap already bounds

The narration is free. The effect, the target and the magnitude have to be
agreed. That is what makes the world fair without making it dull.

## The contract

Seventeen methods, eight of them views, in `contracts/questline.py`. Its own
reference is [contracts/README.md](contracts/README.md): the API names verified
against the pinned SDK, the consensus design, the error classes, the roll, and
the traps that cost time.

### The roll

    sha256(at | player | line index), first two bytes, mod 20, plus 1

All three inputs are public, so anybody can recompute any roll. Three
independent implementations are held against each other: the contract, the
browser at `/verify`, and `verify_roll` as a view. `tests/parity` compares the
first two on every value `contracts/test_helpers.py --json` publishes, so they
cannot drift apart quietly.

### Behaviour worth knowing

**Failing to decide never damages a player.** If the model's answer cannot be
parsed the action resolves as no effect with a short in-world message, and the
energy is not spent. The attempt is still published, because a world that hides
its own failures is back to being a private server.

**Energy decrements only on resolution.** A rotated leader or an undecided
action never silently burns a turn.

**Records act on acceptance, money waits for finality.** Chronicle lines and
state changes act on `ACCEPTED`, because a game that waited for finality on
every turn would not be a game. Season passes, item mints and prize payouts wait
for `FINALIZED`, because a reversal after a payout cannot be undone.

**An item is minted once.** The mint is recorded in storage before the fee joins
the pool, a second attempt is refused, and the character sheet shows the fact
rather than a button that would charge again.

## The site

Next.js 14 App Router, eight routes, every one of them reading the chain
server-side with a five second ceiling per read and a fallback that degrades
rather than errors.

**With no contract configured the site runs a seeded world and says so on every
page.** That is not a mock: **every roll in it verifies.** Each seeded line's
timestamp is searched until `sha256(at | player | index) mod 20 + 1` equals the
roll the line claims, so the arithmetic printed on `/chronicle/[index]` is real
arithmetic a reader can follow. A product whose whole pitch is "you can check
us" cannot ship a demo that quietly cannot be checked.

### A failed read never becomes a claim about the world

Every read carries `status: absent | unavailable`. `absent` requires proof: the
contract's own "no chronicle line with that index", or its own `exists: false`
for a player. Everything else is `unavailable` and the page offers a retry.

That distinction was worth four separate bugs. A busy node served a hard **404**
for a real chronicle line, which is a permanent claim that gets cached and
indexed. A real player was told **"this address has never entered the world"**
with a seeded inventory underneath it. A dropped poll **swapped seeded lines
into a feed labelled LIVE**. And a connected wallet would have been shown a
**seeded character as their own**.

All four now hold the last good state or say plainly that the node did not
answer. Proven by building against a contract address that does not exist.

### The share card is built from the chain

`/api/og/[index]` fetches the line by index rather than rendering text handed to
it in a url. A card that drew whatever the url said would let anyone mint a
convincing screenshot of a roll that never happened. `/api/og` with no index is
the site's own card.

## What stands between a narration and a state change

Seven mechanisms, all of them in the contract, all of them running on every
action.

1. **A roll made before the model speaks.** Seeded from the action's own
   timestamp, player and line index, computed in the deterministic half, and
   published beside the outcome for anyone to recompute.
2. **A band the narration cannot argue with.** A failed roll may only do what
   `FAIL_EFFECTS` allows. A narration claiming a triumph on a two moves nothing.
3. **A magnitude ceiling applied after the fact.** The region publishes a cap,
   the band halves it for a partial success, and whatever the model asked for is
   clamped to it before it is applied.
4. **A registry that is the final word.** An item exists because it is in
   contract storage. An invented one degrades to no effect, and one you already
   carry cannot be granted twice.
5. **Exits matched against the region, not against plausibility.** You move to a
   published exit or you do not move.
6. **Independent resolvers who must agree.** Every validator resolves the action
   itself and the result only stands where the state changes match.
7. **A public line either way.** Undecided actions are published like any other,
   with the energy refunded, because the failures are the evidence.

## Running it

```bash
npm install
npm run dev          # http://localhost:3400
npm test             # house style, parity tests, contract tests
npm run match        # are the deployed bytes this file?
npm run match -- --lint    # ...and does the linter pass on what the chain returned?
```

The whole suite runs on a fresh clone with **no `npm install`**: the house style
check, `node --test` over `tests/parity`, and `contracts/test_helpers.py` use
only builtins and Node's own type stripping.

`npm run match` is the one that checks the claim rather than restating it. It
asks the chain for the source it is running, compares it byte for byte against
`contracts/questline.py`, and separates a line-ending difference from a genuinely
different contract - the first means nobody can reproduce the comparison, the
second means the rules on screen are not the rules that ran.

`--lint` then runs `genvm-lint` over the bytes the chain returned rather than
over the file on disk. Those are different questions: linting the repository
proves the repository. A deployment is only proven by linting what the chain
actually holds.

Deploying, seeding and verifying a live world are in
[docs/DEPLOY.md](docs/DEPLOY.md).

---

<div align="center">

Built by **InferNode**

</div>
