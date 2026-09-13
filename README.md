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

**[www.questline.world](https://www.questline.world)**

</div>

---

## Deployment

| | |
| --- | --- |
| Site | [www.questline.world](https://www.questline.world) |
| Contract | [`0x744ddd0794945e3E487c0F82b03af544C91E1718`](https://explorer-studio.genlayer.com/address/0x744ddd0794945e3E487c0F82b03af544C91E1718) on GenLayer Studio |
| Repository | [github.com/meitipro/questline](https://github.com/meitipro/questline) |
| Deployed source | `npm run match` reports COSMETIC ONLY: the Studio editor stored CRLF line endings, and not one byte Python executes differs from `contracts/questline.py`. Lint and validation pass on the deployed bytes |
| World published | [the item registry](https://explorer-studio.genlayer.com/tx/0xa099030f18d970b636ef3cb30cdbc5f20e7b6a5b93e50f575487d29699633661) and four regions, by the owner |
| First action | [line 0, roll 12 of 20, partial](https://www.questline.world/chronicle/0) - [transaction](https://explorer-studio.genlayer.com/tx/0xf999e2b22e19620970d2682c18df6dfc0813398287ecbd0908234374e111293b) |
| A failed roll holding | [line 1, roll 2: take the long stair, and nothing moved](https://www.questline.world/chronicle/1) - [transaction](https://explorer-studio.genlayer.com/tx/0x7020a7d6f8f6f8fbcb79d01592ddcada50c6194b608bce64819a07d79b83881f) |
| Refusal on chain | [a wallet that is not the owner tries to change the world, refused with "only the owner can change the world"](https://explorer-studio.genlayer.com/tx/0x1af249b40d2ec8efa33fac4caa3e73d1786e083e2c1609077c5ed62ac37e60eb) |

Line 0 as stored, read back from its own receipt:

```json
{
  "action": "read what is carved above the arch",
  "at": "2026-09-13T23:22:36",
  "band": "partial",
  "band_cap": 2,
  "decided": true,
  "effect": "none",
  "index": 0,
  "inventory": "nothing",
  "magnitude": 0,
  "region": 0,
  "region_cap": 4,
  "region_name": "the sunken archive",
  "roll": 12,
  "rules_version": 1,
  "target": "",
  "text": "You read the carving above the arch. The archive echoes the final word back to you.",
  "who": "0x3e1d268c8b1ba7d042968ab713467c5631831513"
}
```

---

## Overview

A world is a set of regions, each with published rules, a magnitude ceiling and
exits, plus a registry of every item that can exist. A player enters and types
what their character does. An Intelligent Contract on GenLayer rolls first, from
public data, then several validators each decide on their own what the action
changed, and the contract applies only what they agreed on, inside caps the
model cannot talk past.

Two decisions carry the product.

**The code decides what is possible, the model decides what happens inside it.**
`act()` is written to be read in three parts: the deterministic half decides
what is POSSIBLE, the model decides what HAPPENS inside that box, and the
deterministic half applies the caps the model cannot exceed. Every interesting
check sits on one side of the non-deterministic block or the other, never inside
it.

**Only what the network agreed on changes the world.** Validators compare the
effect, its target and, for damage and heal, the magnitude, exactly. The
narration is never compared: it is prose, it changes nothing, and two correct
models never write the same sentence.

Nobody here can cheat, and that includes the people who built it. The operator
cannot mint an item, cannot reroll a loss, and cannot change what a rule said
after you played by it.

---

## How it works

| | Step | What the contract does |
| --- | --- | --- |
| 1 | You type an action | Strips angle brackets and hands the text to the model as speech inside the world, never as an instruction |
| 2 | The dice are rolled | A d20 from a hash of the timestamp, the player and the line index, in the deterministic half, before any model runs. 1 to 5 fails, 6 to 15 is partial, 16 to 20 succeeds |
| 3 | The evidence is built | The region and its rules version, what you carry, the legal moves, the item registry, the band and the magnitude ceiling |
| 4 | Every validator resolves it | Each node runs the same prompt over the same evidence and forms its own answer. Comparative, not graded |
| 5 | The answers are compared | Effect, target and, for damage and heal, magnitude - exactly, with no tolerance. The narration is never compared |
| 6 | The caps are applied | A failed roll can only do nothing, deal damage or take an item. Magnitude is clamped to the band. An item outside the registry, or a move to anything but a published exit, becomes nothing |
| 7 | The line is written | With the roll, the band, the rules version and your inventory at the time. An action nobody could decide is published too, and costs no energy |

Each player has 20 health and 5 actions per 6 hour cycle, and energy is spent
only when an action resolves.

---

## Why this needs GenLayer

A text world needs a referee that can read a sentence. That is a model, and a
model on an ordinary chain is a server somebody owns.

The obvious design is to let validators grade the leader: show them the answer
and ask whether it is permissible. That does not work here. Grading only asks
"is this a permissible resolution", and for almost any action several are. A
leader that always chose the most generous legal outcome would pass every
grading and still be robbing the world, because no other node ever forms an
opinion of its own. So `act` uses `gl.vm.run_nondet` with a validator that
resolves the action itself and compares the state change.

- **The contract owns** the roll, the rules and their versions, the caps, the
  registry and the chronicle.
- **The frontend owns** the text box, the narration on screen and the copy.
- **The chain owns** the outcome - and writes nothing the validators did not
  agree on.

---

## What crosses consensus, and why that is the whole design

`run_nondet` stores the LEADER's answer; a validator only says yes or no to it.
So the one property that matters is that agreement implies the same stored
outcome: whatever a validator agreed to must be exactly what gets written. Two
earlier versions broke it, and both were fixed by comparing less, not more.

| what is compared | how | why |
| --- | --- | --- |
| effect | exactly | it names the change |
| target, for items and moves | exactly, normalised | the target is the outcome |
| magnitude, for damage and heal only | exactly, after clamping to the band ceiling | the only effects where the number moves anything |
| narration | never | it is prose, and it changes nothing |

- **A tolerance of one on magnitude was removed.** It stored the leader's number
  while a validator had resolved the same action differently - 4 damage applied
  where another node said 3. Nothing downstream can tell that apart from
  unanimity.
- **`none` and `discover` are no longer collapsed.** Neither moves state, but
  they are stored as different words, so collapsing them let a leader publish
  `discover` on a line a validator resolved as `none`. A word on a permanent
  record is the record.
- **Magnitude is dropped for items and moves**, where `act` never reads it. Five
  of the seven effects need no agreement on a number at all.

`contracts/test_helpers.py` checks the property as a sweep rather than a few
cases: any two decisions `_decisions_agree` accepts must store the same outcome.

---

## The contract

**Seventeen methods, eight view and nine write**, `genvm-lint` clean, in
`contracts/questline.py`. Its own reference is
[contracts/README.md](contracts/README.md): the API names verified against the
pinned SDK, the consensus design, the error classes and the traps that cost
time.

### The roll

    sha256(at | player | line index), first two bytes, mod 20, plus 1

All three inputs are public, so anybody can recompute any roll. Three
implementations are held against each other: the contract, the browser at
`/verify`, and `verify_roll` as a view. `tests/parity` compares the first two on
every value `contracts/test_helpers.py --json` publishes, so they cannot drift
apart quietly.

```ts
const roll = await client.readContract({
  address: QUESTLINE,
  functionName: "verify_roll",
  args: [line.at, line.who, line.index],
});

if (Number(roll) !== line.roll) {
  throw new Error(`line ${line.index} claims a roll these rules did not make`);
}
```

### Behaviour worth knowing

- **Failing to decide never damages a player.** If the model's answer cannot be
  read, the action resolves as no effect with a short in-world message and the
  energy is not spent. The attempt is still published, because a world that
  hides its own failures is back to being a private server.
- **Rules are versioned, never edited.** `revise_region` publishes a new
  version, and every line keeps the version it was resolved under.
- **Records act on acceptance, money waits for finality.** Chronicle lines act
  on `ACCEPTED`, because a game that waited for finality on every turn would not
  be a game. Season passes, item mints and prize payouts wait for `FINALIZED`,
  because a reversal after a payout cannot be undone.
- **An item is minted once.** The mint is recorded in storage before the fee
  joins the pool, a second attempt is refused, and the character sheet shows the
  fact rather than a button that would charge again.
- **Every owner method checks the owner.** A write from anyone else is refused
  on chain with "only the owner can change the world" - the refusal in the
  deployment table above.

---

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
   *Correction, 2026-09-14:* until then nobody moved at all. The evidence lists
   each exit as "move to the long stair", the criteria said a move's target must
   be one of the legal moves, and the model obeyed both by returning the whole
   phrase - which matches no exit, so every move degraded to none. Found on
   chain on 0x1998E9Cb, where a roll of 18 stored none while the narration
   climbed the stair. The criteria now ask for the region name alone, and
   `_target_of` strips the phrase regardless.
6. **Independent resolvers who must agree.** Every validator resolves the action
   itself and the result only stands where the state changes match.
7. **A public line either way.** Undecided actions are published like any other,
   with the energy refunded, because the failures are the evidence.

---

## The site

Next.js 14, App Router. Nine screens: the landing, play, the world and its
rules, the chronicle and each line's permalink, a character sheet, the season,
verify a roll, and `/admin` for the owner.

**Nothing is announced before the chain has answered.** A GenLayer receipt
carries three fields that all read like a verdict, and two of them mislead:
`status` is `FINALIZED` on a refused call, and `result` is `MAJORITY_AGREE`
when validators agree that a call failed. Every write here asserts
`consensus_data.leader_receipt[].execution_result`, the one field that answers
"did my code run".

**A failed read never becomes a claim about the world.** Every read carries
`status: absent | unavailable`, and `absent` requires proof: the contract's own
"no chronicle line with that index", or its own `exists: false` for a player.
Everything else is `unavailable` and the page offers a retry, rather than a 404
that gets cached or a seeded character shown to a real wallet as its own.

**A payment the contract will refuse is never offered.** The season pass stays
locked until the contract says this address has entered, because on Studio a
refused payable call keeps the value sent with it.

**`/admin` publishes the world from a browser wallet.** An owner who deploys
through the Studio editor has no private key to hand a script, so the five
setup transactions are signed in the wallet, planned from what the chain
already holds.

With no contract configured, the site runs a seeded world and says so on every
page, and every roll in it verifies: each seeded line's timestamp is searched
until the hash gives the roll the line claims.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3400
```

| Command | What it does |
| --- | --- |
| `npm test` | House style, 69 parity checks in Node, and 278 checks of the contract's pure half on plain CPython. No network |
| `npm run match` | Asks the chain for the source it runs and compares it byte for byte with `contracts/questline.py`, separating a line-ending difference from a different contract. Add `-- --lint` to run `genvm-lint` over the deployed bytes |
| `npm run lint:contract` | `genvm-lint` over `contracts/questline.py` |
| `npm run deploy` | Deploys the contract with a key read from the environment, never from an argument |
| `npm run seed` | Publishes the opening world, the registry first and then the four regions, and refuses a key that is not the owner |
| `npm run verify` | Reads the live contract and recomputes the newest rolls in the app and on the contract |
| `npm run e2e` | End to end on a real network with a throwaway account |
| `npm run admin` | Owner only: revise a region, close a season, open the next |
| `npm run lint` / `npm run typecheck` | ESLint and `tsc --noEmit` |

The whole suite runs on a fresh clone with **no `npm install`**: the house style
check, `node --test` over `tests/parity`, and `contracts/test_helpers.py` use
only builtins and Node's own type stripping.

`NEXT_PUBLIC_*` values are inlined at build time, so a new contract address
needs a rebuild, not a restart. Deploying, seeding and verifying a live world
are in [docs/DEPLOY.md](docs/DEPLOY.md).

---

## What a green suite does not prove

Every gate here was green on the day the contract stored a number half the
network disagreed with. So some checks do not run the code at all - they read
it.

- **Static checks over the parsed source.** Every `@gl.public.write` must call
  `_require_owner()`, resolve the caller's own character, or read the sender.
  Proven to bite by removing one gate and watching it fail.
- **The agreement property swept, not sampled.** Any two decisions the
  validator accepts as agreeing must store the same outcome.
- **A mutation, not a pass.** With the move fix removed from a copy of the
  contract, four of its eight checks fail.
- **The deployed source is diffed against this file.** Line endings and a
  trailing newline are reported as cosmetic, because a checker people learn to
  ignore stops catching what matters.

And the chain found three things the suite did not, all on the first real run:

| found on chain | what was wrong | fixed |
| --- | --- | --- |
| A new wallet connected and was offered Act | The page read a player it never stores for an address that has not entered, so Enter never appeared | Entry is three states in `lib/entry.ts`, pinned by parity tests |
| A roll of 18 on take the long stair stored none | The model returned the menu phrase "move to the long stair" as the target, which matches no exit, so nobody could leave the first region | `_target_of` strips it and the criteria ask for the name alone |
| A wallet paid 25 GEN for a pass before entering | The site offered a payment the contract refuses, and Studio kept the value | The pass is locked until the contract says you entered |

---

<div align="center">

Built by **InferNode**

</div>
