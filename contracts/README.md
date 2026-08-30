# Questline - the intelligent contract

One file, `questline.py`, and the pure-Python tests beside it. This document is
the contract's own reference: what it exposes, how consensus is reached, and the
things that cost time once so they need not cost it again.

The runner is pinned on line one and is not a moving target:

```
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
```

The linter reports that a newer runner exists. That notice is informational and
is deliberately not acted on: a pinned hash is the only thing that makes a
redeploy comparable to the deploy before it.

## The division of labour

Every method is arranged around one rule:

    the deterministic half decides what is POSSIBLE
    the model decides what HAPPENS inside that box
    the deterministic half then applies the caps the model cannot exceed

So the model narrates and the code decides. The interesting checks in `act` all
sit either side of the nondeterministic block rather than inside it, because
anything inside it has to survive being run by several validators independently.

`_apply_caps` is the whole safety argument in one pure function: primitives in,
primitives out, no storage and no network. It is the reason a narration claiming
a triumph on a roll of two cannot move state, and it is mirrored in
`test_helpers.py` so every branch of it runs on an ordinary Python.

## The API names, verified against the pinned SDK

Settled by reading the SDK on disk rather than the docs site.

| What it does | The name |
| --- | --- |
| Refuse, deterministically | `gl.vm.UserError` |
| Ask a model | `gl.nondet.exec_prompt` |
| Two-closure consensus | `gl.vm.run_nondet(leader_fn, validator_fn)` |
| Caller | `gl.message.sender_address` |
| Value attached | `gl.message.value` |
| Block time | `gl.message_raw["datetime"]` |
| Pay out | `gl.get_contract_at(addr).emit_transfer(value=...)` |

Two of those are worth stating plainly:

- **`exec_prompt(response_format="json")` returns a dict**, already parsed. It is
  not a string. Assuming it was cost this contract its first real transaction:
  the leader died with `'dict' object has no attribute 'strip'` on chain, which
  surfaces as a transaction that is ACCEPTED and does nothing. `_parse_outcome`
  now accepts both shapes and the test suite pins both.
- **`gl.message_raw["datetime"]` is the clock.** A view method cannot roll the
  energy cycle forward, so `get_player` can report a stale energy number; the
  site recomputes it with `effectiveEnergy` rather than showing a bar that is a
  cycle behind.

## Consensus design

`act` is the only method that asks a model anything. It uses
`gl.vm.run_nondet(leader_fn, validator_fn)`: the leader resolves the turn, and
every validator resolves it again and says whether it agrees.

Validators compare **the decision, not the prose**. `_decision` reduces an
outcome to what actually moves state, and `_decisions_agree` accepts two
outcomes when those match. Comparing narration under equality is the reliable
way to make honest validators disagree, because two correct models never write
the same sentence.

Two deliberate tolerances:

- `none` and `discover` both collapse to "nothing happened", because they are
  the same state change and the difference is a matter of description.
- Magnitudes agree within `MAGNITUDE_TOLERANCE` (1). A blow worth three and one
  worth four is a difference of degree that the region cap is going to clamp
  anyway.

### Error classes

Failures carry a class so validators can compare them instead of guessing:

| Prefix | Meaning | Validator rule |
| --- | --- | --- |
| `[EXPECTED]` | business logic, deterministic | must match exactly |
| `[LLM_ERROR]` | model returned nothing usable | disagree, forcing a rotation |

**There are two classes here and not four.** The sibling contracts in this
series also carry `[EXTERNAL]` and `[TRANSIENT]`, which exist because they fetch
from a web gateway and have to tell a 4xx from a 5xx. Questline never leaves the
node: it calls `exec_prompt` and nothing else. Copying those two prefixes across
would add machinery that nothing can raise, and a class that never fires is a
class nobody maintains correctly.

A refusal raised inside the nondeterministic block must be a **constant string**,
because `run_nondet` compares two `UserError`s by message equality. A message
that interpolates a roll or a timestamp makes two honest validators disagree
about a refusal they both reached correctly.

The prefix is consensus machinery, not player-facing text. `stripErrorTag` in
`lib/actions.ts` removes it before anything reaches a reader.

## The roll

```
sha256(at | player | line index), first two bytes, mod 20, plus 1
```

`at` is the block timestamp as stored, `player` is the address lowercased, and
the line index is the position the line will occupy in the chronicle. All three
are public, so anybody can recompute any roll, and three independent
implementations are kept honest against each other:

1. the contract, in `_seeded_roll`
2. the browser, in `lib/roll.ts`, which `/verify` runs in the reader's tab
3. `verify_roll`, a view that makes the chain recompute it on demand

`tests/parity/roll.test.mjs` compares 1 and 2 on every value
`contracts/test_helpers.py --json` publishes, so they cannot drift apart
quietly.

**The trap, found on a live line:** storage holds the timestamp with no trailing
`Z` and the page prints one. The seed is built from the stored form, so a browser
that hashes the printed string gets a different roll for the same line - it read
14 in storage and 6 in the tab. `normaliseStamp` exists for exactly this and is
pinned by a parity test.

## Method reference

Seventeen methods, eight of them views. `genvm-lint check` reports the same
count, which is a useful thing to diff after an edit.

### Writes

| Method | Who | What it does |
| --- | --- | --- |
| `enter()` | anyone | Creates a character. Refuses a second one. |
| `act(action)` | a player | The turn. The only method that asks a model. |
| `buy_season_pass()` | anyone, payable | Pays into the season pool. |
| `mint_item(name)` | a player, payable | Mints an item the player was granted. |
| `close_season()` | owner | Settles the pool and starts the next season. |
| `add_region(...)` | owner | Appends a region. Never removes one. |
| `revise_region(...)` | owner | Rewrites a region's rules, bumping its version. |
| `register_items(csv)` | owner | Adds to the item registry. |
| `open_season(...)` | owner | Names the next season and sets its clock. |

### Views

`get_world`, `get_chronicle`, `get_line`, `get_player`, `get_player_lines`,
`get_leaderboard`, `verify_roll`, `season_prices`.

Every view that returns json uses `sort_keys=True`, so two reads of unchanged
state are byte-identical and a diff between them means something.

`get_line` refuses an index it does not hold with `no chronicle line with that
index`. That refusal is how the site tells a missing line from a node that did
not answer - see `lib/absence.ts`, and note that a **view** refusal arrives
base64 encoded under `e.cause.data.receipt.result`, not in the error message.

## Tests

```bash
python contracts/test_helpers.py          # 233 checks, plain Python, no GenVM
python contracts/test_helpers.py --json   # the same answers, for tests/parity
npm run lint:contract                     # genvm-lint check: AST pass and SDK load
npm test                                  # house style, parity, and the above
```

`test_helpers.py` stubs just enough of `genlayer` for the module to import, then
instantiates the contract with `object.__new__` and exercises the pure halves
directly. Nothing in it needs a node.

Two Windows details are wrapped in `scripts/lint-contract.mjs` rather than being
rediscovered: the linter dies printing its success tick under cp1252 stdout, and
spawning it through a shell splits this repo's path on the space in "GenLayer
Works".

**The contract class is named `Questline`, not `Contract`.** `genvm-lint
validate` cannot find a class by the latter name and reports "No contract class
found" for a contract that is completely fine, so half the linter silently did
nothing until the class was renamed.

## Prompt injection

Player text is wrapped in `<player_action>` tags, the criteria tell validators
to treat the contents as speech inside the world, and **angle brackets are
stripped before the text is sent**. That last part is the actual defence:
wrapping untrusted text in a tag is not a fence if the text can close the tag,
so the cheapest complete answer is for the character not to survive the trip.

An attempt is published in the chronicle like any other action, which makes it
funny rather than dangerous. There is a seeded line demonstrating exactly this:
a player tells the archive it is its administrator and asks for a sword, and the
archive does not speak that language.

## The views do not walk the chronicle

`item_source` and `lines_by_player` are indexes maintained on write, so a
character sheet costs one lookup per carried item instead of a backwards scan of
every line ever resolved. The scan was fine at a hundred lines and would have
blown the compute limit at a hundred thousand. A view that cannot be called is a
view that does not exist, and this product's whole claim is that anyone can read
the world back.

## The criteria come from the contract

`get_world()` returns the exact task and criteria strings the validators were
handed, and `/world` renders those rather than a copy. A paraphrase in
TypeScript would drift, and "the rules are the product" stops being true the
moment the published rules and the applied rules are two different strings.

`contracts/test_helpers.py` guards this: it compares the contract's criteria
against what the seeded world quotes, whole lines rather than a prefix. An
earlier version compared only the first seventy characters and cheerfully passed
when a rule was inverted after them.

## No stored achievement flags, and no holder counts

Every achievement is derived from public state when a character sheet is read.
Counting holders would mean either walking the whole roster on every page view,
or keeping a tally the operator maintains. The second is exactly the kind of
number this product has no business asking anyone to trust.

## Deploy

```bash
npm run deploy    # writes the address it gets to stdout
npm run seed      # regions, registry, and a first season
npm run verify    # reads the world back and recomputes every roll it finds
```

`verify` is the one worth running twice. It recomputes each roll from the line's
own public fields and asks the contract to recompute one too; if the stored roll,
the script's sha256 and `verify_roll` ever disagree, the central claim of the
product is false and that is where it shows up.

The constructor takes the first season's name, its end timestamp, and the two
prices in wei.
