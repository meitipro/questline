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

## Running it

```bash
npm install
npm run dev          # http://localhost:3400
```

With no contract address configured the site runs a seeded demonstration world
and says so on every page. That is not a mock: **every roll in it verifies.**
Each seeded line's timestamp is searched until
`sha256(at | player | index) mod 20 + 1` equals the roll the line claims, so the
arithmetic printed on `/chronicle/[index]` is real arithmetic a reader can
follow. A product whose whole pitch is "you can check us" cannot ship a demo
that quietly cannot be checked.

## Deploying

```bash
$env:QUESTLINE_DEPLOYER_KEY = "0x..."
npm run deploy                              # prints what it will do, waits for yes

$env:NEXT_PUBLIC_QUESTLINE_ADDRESS = "0x..."
npm run seed                                # registry first, then four regions
npm run verify                              # reads it back and re-verifies the rolls
```

`npm run seed` is idempotent by construction: `register_items` skips names it
already holds and `add_region` refuses a duplicate, so a rerun after a dropped
connection finishes the job rather than doubling it.

Putting the site on Vercel needs no special handling: the routes under `app/api`
are the backend and deploy as functions automatically. The only rule worth
stating twice is that `NEXT_PUBLIC_*` values are inlined at build time, so
changing the contract address in a dashboard does nothing until you redeploy -
and the deployer key is never one of them, because the site signs nothing.

Owner-only world changes - revising a region's rules, closing a season, opening
the next one - live in `npm run admin` rather than behind a button:

```bash
node scripts/admin.mjs status
```

Revising a region changes what every future action is judged against, and
closing a season moves the pool. Neither belongs somewhere a misplaced tap can
reach. Each prints exactly what it will do, including the payout table and the
Studio caveat, and waits for a typed `yes`.

`npm run verify` is the one worth running twice. It recomputes every roll it reads
from the line's own public fields with its own implementation of sha256, then
asks the contract to recompute one through `verify_roll`. If the stored roll, the
script's arithmetic and the chain's arithmetic ever disagree, the central claim
of the product is false and that is where it surfaces.

## Testing the contract

```bash
npm test                                    # all three of the below, in order
npm run check                               # house style, as a check that fails
npm run lint:contract                       # genvm-lint: AST pass, then SDK load
python contracts/test_helpers.py            # 232 checks, no GenVM needed
```

`npm test` runs the house style check, then 34 parity tests, then those 232.

The parity tests are the interesting ones. `contracts/test_helpers.py --json`
prints every answer the Python half gives, and `tests/parity` re-derives all of
them in TypeScript against the real `lib` modules, so the browser's arithmetic
and the contract's are compared rather than each being trusted on its own.
Nothing in them is written by hand, so tightening a rule in the contract makes
the JS side fail without anyone editing it.

`lib/roll.ts` implements sha256 by hand, so it is checked against `node:crypto`
across every padding boundary - a naive implementation passes a short input and
fails at 56 bytes, which is exactly the length a real seed reaches. And
`lib/absence.ts` decides whether a failed read means "this does not exist" or
"I could not ask"; its first version was wrong, and that suite is what found it.

The deterministic halves are pure functions of their arguments, so they run on an
ordinary Python with a small `genlayer` stub. The most important one by a
distance is `_apply_caps` - the list of things a narration cannot talk its way
past - and every branch of it is pinned:

- an effect outside the allowed list becomes `none`
- a failed roll can hurt you and take from you, and can never grant, heal, move
  or discover
- magnitude is clamped to the band ceiling, which for a partial is half the
  region's cap rounded up
- an item not in the registry cannot be granted, and neither can one you already
  carry
- you cannot lose what you never had, or move through an exit that is not
  published

On Windows, `export PYTHONIOENCODING=utf-8` before running `genvm-lint`, or it
dies with a `UnicodeEncodeError` printing its own tick mark. `genvm-lint validate`
cannot see a class named `Contract` (it skips it by name, which is the GenLayer
convention), so rename the class into a temp file to validate:

```bash
sed 's/^class Contract(gl.Contract):/class Questline(gl.Contract):/' \
  contracts/questline.py > /tmp/named.py && genvm-lint validate /tmp/named.py
```

## Light and dark

Dark is the default - it is the palette the design was drawn in. Light is a warm
paper theme, opted into with `data-theme="light"` on `<html>`.

`prefers-color-scheme` is consulted exactly once, in the boot script, and only
when a visitor has never chosen. After that the stored choice wins: an OS that
flips to dark at sunset should not overrule a person who picked light.

Three colours carry a `-text` variant, because the fill that works as a border
does not always clear 4.5:1 as a 12px label. The pairs were measured rather than
eyeballed, and the numbers are written down at the top of `app/globals.css`.
`--on-accent` is the label that sits *on* the accent and stays near-black in both
themes; without it the primary button goes paper-on-orange in light.

Every token pair the product actually uses passes WCAG AA in both themes - worst
case 4.61:1 in dark and 4.52:1 in light - and a DOM sweep of all eight routes in
both themes reports no failures. Decorative glyphs (the `.` separators, the `×`
and ` - ` bullets) are `aria-hidden`, which is why they are allowed to stay faint.

## Layout

    contracts/questline.py     the world: regions, registry, players, chronicle
    contracts/test_helpers.py  232 checks, and --json for the parity tests
    contracts/README.md        the contract's own reference
    lib/chain.ts               the ONE place that picks the network
    lib/contract.ts            cached server reads, with a sample fallback
    lib/actions.ts             wallet writes, with a stage per transaction phase
    lib/useWallet.ts           shared wallet state, incl. account/chain changes
    lib/roll.ts                the roll recomputed in the browser
    lib/absence.ts             "missing" told apart from "could not ask"
    lib/outcomes.ts            the item registry and what a local turn may do
    lib/sample.ts              the seeded world, whose rolls verify
    app/api/*                  cached read routes, and the og share card
    tests/parity/              the browser's arithmetic against the contract's
    scripts/check.mjs          house style, as a check that fails
    scripts/verify.mjs         reads the live world back and recomputes its rolls
    scripts/                   deploy, seed, admin, e2e, lint-contract

### Routes

| route              | its one job                                          |
| ------------------ | ---------------------------------------------------- |
| `/`                | make a stranger want to type something               |
| `/play`            | be a place people sit in for an hour                 |
| `/chronicle`       | turn play into public content                        |
| `/chronicle/[i]`   | one line, and the arithmetic behind its roll         |
| `/c/[player]`      | give a player something to be proud of               |
| `/world`           | make the rules legible, since fairness is the pitch  |
| `/season`          | give the game a clock                                |
| `/verify`          | let a reader check the dice themselves               |

## /verify

Every other page in the product *asserts* that a roll can be recomputed from
public data. This one lets a reader do it.

Three fields go in - when the action resolved, who took it, which line it became
 - and the page shows the seed string, the full sha256, the first two bytes as a
decimal, and the modulo. Change one second of the timestamp and the roll changes;
the page then says the chronicle's number "should be impossible" in red. It is
built to be able to fail, because a verifier that can only agree is decoration.

The second half recomputes **every line the page is holding**, in the browser,
with a tally that climbs while you watch. It yields to the event loop every few
lines on purpose: the arithmetic would otherwise finish before a frame painted,
and a number that simply appears reads as an assertion rather than a computation.

It talks to nothing. No RPC, no API, no server round trip - the same sha256 that
`lib/roll.ts` ships to the browser, over data already on the page. If this site
were lying about a roll, this is the page that would catch it.

## Accessibility

- **Focus is visible again.** The design removes the browser ring from inputs,
  and nothing had replaced it, so tabbing through the site showed nothing -
  the action console, every filter chip, every feed row, invisible to a
  keyboard. `:focus-visible` gives an accent ring with an offset, so a mouse
  click leaves nothing behind but a Tab key does.
- **`prefers-reduced-motion` is honoured.** The validator bars sweep
  continuously and the live dot pulses forever; for a reader with vestibular
  sensitivity that is not decoration, it is something they have already told
  their computer about. Reduced motion holds the bars at a steady partial fill
  so they still read as five validators working.
- **A skip link**, so a keyboard reader does not tab the header on every page.
- Decorative glyphs - the `.` separators, the `×` and ` - ` bullets - are
  `aria-hidden`, so a chronicle line is read as "0x88a1, the sunken archive,
  rules v3" rather than "0x88a1 dot the sunken archive dot rules v3".

## Decisions worth knowing about

**Studio, not Bradbury.** On 2026-07-29 the GenLayer team confirmed a Bradbury
network fault: a deploy reports `FINALIZED` with `result_code 0` and written
storage, and `gen_getContractCode` then answers "contract code not found at
address". `lib/chain.ts` is the single switch, and every value below it - chain
id, RPC, explorer, gas policy, faucet - derives from genlayer-js's own chain
objects rather than being retyped, so they cannot drift. Studio reports
`eth_gasPrice = 0` and has no faucet, so the "you have no GEN" pre-flight guard
is conditional on `REQUIRES_GAS`; without that it would refuse every write on
Studio. Studio's explorer answers 503, so explorer links are dropped rather than
pointed at a dead host.

**Contract addresses are per network.** Flipping `NEXT_PUBLIC_GENLAYER_NETWORK`
without redeploying points the app at an address that does not exist.

**Validators resolve the action themselves - they do not grade the leader.**
The obvious choice is `prompt_non_comparative`: validators read the leader's
answer and check it against the written criteria. The problem is that grading
only asks "is this a permissible resolution", and for almost any action several
resolutions are permissible. A leader that always chose the most generous legal
outcome would pass every grading and still be robbing the world, because no other
node ever forms an opinion of its own.

So `act` uses `gl.vm.run_nondet` with a validator that resolves the action
independently and compares `_decision` - the state change, not the prose:

- `none` and `discover` collapse to "nothing", because neither moves state
- `damage` and `heal` carry no target; the target is always the player
- magnitude is clamped to the band ceiling first, then compared with a tolerance
  of one - a difference of degree the region cap already bounds

The narration is never compared, which is what the brief wanted. The effect, the
target and the magnitude have to be agreed, which is what makes the world fair.
`run_nondet` rather than `run_nondet_unsafe` because a refusal is a designed
outcome here and `run_nondet` sandboxes the validator; `run_nondet_unsafe` would
record a raising validator as a flat disagreement.

The undecidable case is a constant message (`UNDECIDED`) for a reason:
`compare_user_errors` defaults to message equality, so a refusal that
interpolated anything would give every validator a different sentence and the
clean failure path would degrade into a bare disagreement.

**Accepted versus finalized.** Chronicle lines and state changes act on
`ACCEPTED`, because a game that waited for finality on every turn would not be a
game. Season passes, item mints and prize payouts wait for `FINALIZED`, because a
reversal after a payout cannot be undone.

**A failed read never becomes a claim about the world.** Every read carries
`status: absent | unavailable`. `absent` requires proof - the contract's own "no
chronicle line with that index", or its own `exists: false` for a player.
Everything else is `unavailable` and the page offers a retry.

This applies in four places and the failure mode was different in each:

- `/chronicle/[index]` served a hard **404** for a real line when the node was
  busy. A 404 is a permanent claim, and it gets cached and indexed.
- `/c/[player]` told a real player **"this address has never entered the
  world"** - with a seeded inventory underneath it, because the fallback
  answered `exists: false` for any address it did not recognise.
- the home page's live feed silently **swapped seeded lines into a feed
  labelled LIVE CHRONICLE** on a dropped poll.
- the play console and the season card would have shown a connected wallet a
  **seeded character as their own**.

All four now hold the last good state, or say plainly that the node did not
answer. Proven by building against a contract address that does not exist:
`/chronicle/88213` and `/c/0x88a1...` both answer 200 with a retry, and
`/api/player/...` reports `status: "unavailable"` with zero lines rather than
seeded ones.

**The views do not walk the chronicle.** `item_source` and `lines_by_player` are
maintained on write so a character sheet costs one lookup per carried item
instead of a backwards scan of every line ever resolved. The scan was fine at a
hundred lines and would have blown the compute limit at a hundred thousand.

**The criteria come from the contract.** `get_world()` returns the exact task and
criteria strings the validators were handed, and `/world` renders those. A
paraphrase in TypeScript would drift, and "the rules are the product" stops being
true the moment the published rules and the applied rules are two different
strings.

**No stored achievement flags and no holder counts.** Every achievement is
derived from public state when a character sheet is read. Counting holders would
mean either walking the whole roster on every page view or keeping a tally the
operator maintains, and the second is exactly the kind of number this product has
no business asking anyone to trust.

**Prompt injection.** Player text is wrapped in `<player_action>` tags, the
criteria tell validators to treat the contents as speech inside the world, and
angle brackets are stripped before the text is sent - the cheapest complete
defence against closing that tag early is for the character not to survive the
trip. An attempt is published in the chronicle like any other action, which makes
it funny rather than dangerous.

**Failing to decide never damages a player.** If the model's answer cannot be
parsed the action resolves as no effect with a short in-world message and the
energy is not spent. The attempt is still published, because a world that hides
its own failures is back to being a private server.

**Energy decrements only on resolution.** A rotated leader or an undecided
action never silently burns a turn, which players notice immediately.

**A `loading.tsx` cannot sit above a route that calls `notFound()`.** A loading
file creates a Suspense boundary, and Next flushes the shell - status line
included - before the page resolves, so `notFound()` can only swap the content
afterwards. The route then answers 200 with not-found content, which is a soft
404 a crawler will index. The loading states therefore live on `/play`, `/world`
and `/season` only; `/chronicle/[index]` and `/c/[player]` have none.

**The share card is built from the chain, not from query parameters.** `/api/og/
[index]` fetches the line by index rather than rendering text handed to it in a
url. A card that drew whatever the url said would let anyone mint a convincing
screenshot of a roll that never happened. It also runs on the edge runtime,
which is not a preference: the node build of `next/og` resolves its bundled font
at module scope and throws `ERR_INVALID_URL` on Windows, taking the dev server
with it.

## Running on Studio, specifically

Four measured facts about the Studio network shape this code. None is guessed.

- **IPv6 hangs.** Studio is Cloudflare on both stacks and the AAAA addresses time
  out, so Node - which tries IPv6 first - burns ten seconds per request and every
  server-side read looks like a dead network. `dns.setDefaultResultOrder("ipv4first")`
  is set in `next.config.mjs` and in every script that reaches the chain, because
  the config is the earliest module the server evaluates and a fix applied later
  is applied too late.
- **`gen_call` wants the EIP-55 checksummed address.** The all-lowercase spelling
  of a live contract answers "Contract not found", and the failure looks like an
  empty world rather than an error. `lib/chain.ts` never normalises the configured
  address and warns on startup if it looks unchecksummed. Note this is the
  *opposite* of the rule inside the contract, where a TreeMap key must be
  lowercased on both sides.
- **About thirty reads a minute.** The read cache is 20 seconds for that reason
  alone; nothing depends on it for correctness.
- **A payout never reaches a wallet.** `emit_transfer` is delivered as a contract
  call and an ordinary wallet is not a contract, so the transfer is refused as its
  own transaction: the contract is debited, the payee is not credited, and because
  the transfer fires on finality the verdict cannot roll back. `/season` says this
  out loud rather than printing "paid" over a balance that will not move.

## What this cannot do

Consensus takes longer than a game loop, so this is not a real time game. Actions
are deliberate and scarce, and a turn takes as long as several strangers need to
agree on what happened. The narration varies between turns even where the rules
do not - only the effect, target and magnitude are held to the criteria. And an
appeal costs the protocol bond, which is deliberately larger than any single
action is worth, so appealing is a season-ending move rather than a turn-by-turn
one.
