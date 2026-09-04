# Deploying Questline

Two things get deployed, to two different places, and it helps to be clear about
which is which:

| what | where | who deploys it |
| --- | --- | --- |
| `contracts/questline.py` | GenLayer Studio (chain 61999) | you, from your machine, once |
| the whole Next.js app | Vercel | Vercel, on every push |

**There is no separate backend to host.** The routes under `app/api/` are the
backend, and Vercel turns each one into a serverless function automatically. The
server components do the same reads through the same `lib/contract.ts`. So
"deploying the backend" and "deploying the site" are one action.

The contract is **not** deployed by Vercel and must never be. It needs a private
key, and a key in a build environment is a key in a log.

---

## 0. The repository

It is already one, and it is public:

    https://github.com/meitipro/questline

86 files. `.gitignore` keeps `node_modules`, `.next`, `.env*`, `.claude/`
and this folder's launch material out, so `.env.example` is the only env file
tracked and every value in it is empty. Worth re-checking before any push that
adds files:

```bash
git ls-files | Select-String -Pattern "env|key|pem"
```

That should print `.env.example` and `next-env.d.ts`, and nothing else.

## 1. Import into Vercel

1. vercel.com → **Add New → Project → Import Git Repository** → pick `questline`.
2. Vercel detects Next.js on its own. **Leave every build setting alone** -
   framework Next.js, build `next build`, output `.next`, install `npm install`.
   Root Directory stays blank; the repo root *is* the app.
3. Do **not** click Deploy yet. Open **Environment Variables** first, so the
   first build is already correct.

## 2. Environment variables

Add these to **Production, Preview and Development** (there is a checkbox row
for each - tick all three, or previews will silently run the demo world):

| name | value | why |
| --- | --- | --- |
| `NEXT_PUBLIC_GENLAYER_NETWORK` | `studionet` | which chain the whole app talks to |
| `NEXT_PUBLIC_QUESTLINE_ADDRESS` | *(leave empty for now)* | the deployed contract |
| `NEXT_PUBLIC_ORIGIN` | *(optional)* | canonical host for permalinks and share cards |

Notes that will save you an afternoon:

- **`NEXT_PUBLIC_` is not decoration.** These are read by client components, so
  the prefix is what puts them in the browser bundle. Renaming one to a bare
  `QUESTLINE_ADDRESS` makes it `undefined` in the browser and the site quietly
  falls back to the demonstration world.
- **They are inlined at build time, not read at runtime.** Changing one in the
  dashboard does nothing until you redeploy. Vercel offers a "Redeploy" button
  on the latest deployment for exactly this.
- **`NEXT_PUBLIC_ORIGIN` can stay empty.** `next.config.mjs` maps Vercel's own
  `VERCEL_PROJECT_PRODUCTION_URL` into the client bundle, so permalinks are
  correct on a fresh deploy with nothing configured. Set it only when you have a
  real domain, and set it to the origin with no trailing slash:
  `https://www.questline.world`.
- **Never add `QUESTLINE_DEPLOYER_KEY`.** The site never signs anything. Every
  write - entering the world, acting, buying a pass, minting - is signed by the
  player's own wallet in their own browser. The server holds no key and needs
  none.

Now click **Deploy**. The first build takes about a minute and the site comes up
running the seeded demonstration world with its banner, because no contract
address is set yet. That is the correct intermediate state, not a failure.

## 3. Deploy the contract, from your machine

```bash
cd "G:\GenLayer Works\Questline"
$env:QUESTLINE_DEPLOYER_KEY = "0x..."          # 32 byte hex, never committed
$env:NEXT_PUBLIC_GENLAYER_NETWORK = "studionet"

npm run deploy
```

It prints exactly what it is about to do - network, deployer address, balance,
season name and end date, pass and mint prices - and waits for you to type
`yes`. A zero balance on Studio is expected and not an error; Studio reports
`eth_gasPrice = 0` and has no faucet.

Optional flags: `--season="the sunken archive"`, `--ends=2026-08-27T18:00:00`
(UTC, no zone marker), `--pass=25`, `--mint=2`, `--yes` to skip the prompt.

It ends by printing the address. Then publish the world:

```bash
$env:NEXT_PUBLIC_QUESTLINE_ADDRESS = "0x<the address it printed>"
npm run seed        # item registry first, then the four regions
npm run verify      # reads it back and re-verifies the rolls
```

`seed` is safe to rerun: `register_items` skips names it already holds and
`add_region` refuses a duplicate, so a rerun after a dropped connection finishes
the job rather than doubling it.

Only the account that deployed the contract can seed it. If you seed from a
different key, every call is refused with "only the owner can change the world".

## 4. Point the site at it

Back in Vercel → **Settings → Environment Variables** → edit
`NEXT_PUBLIC_QUESTLINE_ADDRESS` to the deployed address, for all three
environments. Then **Deployments → ⋯ → Redeploy** on the latest one.

Because the value is inlined at build time, the redeploy is not optional.

Keep a local copy too, so `npm run dev` and `npm run verify` agree with
production. Create `.env.local` (git-ignored):

```
NEXT_PUBLIC_GENLAYER_NETWORK=studionet
NEXT_PUBLIC_QUESTLINE_ADDRESS=0x...
```

## 5. Check it landed

The banner disappearing is the signal. To confirm the backend specifically:

```bash
curl https://<your-app>.vercel.app/api/world
```

`"live": true` means the serverless function reached the chain. `"live": false`
with an `"error"` string means it reached Vercel but not the node - the reason
is in the string, and the page degrades to the seeded world rather than 500ing.

Then the one that matters:

```bash
curl https://<your-app>.vercel.app/api/line/0
```

`"verified": true` means the stored roll and the recomputed roll agree.

---

## 6. Before submitting it anywhere

The deployment is the submission. A reviewer fetches the **deployed** source,
diffs it against this repository, and runs the linter on what the chain
returned - so a correct repository proves nothing on its own.

```bash
npm run match -- --address=0x<the deployed address> --lint
```

Three things have to be true, and this prints all three:

- **Match.** The deployed bytes are `contracts/questline.py`, byte for byte.
  A `LINE ENDINGS ONLY` mismatch means the rules are identical but the
  deployment carries CR bytes no checkout has, so nobody can reproduce the
  comparison - redeploy. `DIFFERENT SOURCE` means the chain is running
  something this repository does not describe.
- **Lint passed / Validation passed**, on the bytes the chain returned rather
  than on the file on disk. A submission has been rejected elsewhere for
  deployed source failing the linter while its repository version was clean.
- **17 methods (8 view, 9 write)**, which is what a complete deploy looks like.

The contract page on the explorer is the evidence to cite:

```
https://explorer-studio.genlayer.com/address/0x<the deployed address>
```

It shows the creator, the deploy transaction and every call made against it.

Finally, play one real action against the deployed world and confirm it
resolves - `npm run demo` does this - because deploying and seeding prove the
world exists, not that validators can agree inside it.

---

## A custom domain

**Settings → Domains → Add** `www.questline.world`, then at your registrar:

| type | name | value |
| --- | --- | --- |
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

Vercel shows the exact records for your case and verifies them itself - prefer
what the dashboard tells you over the table above if they differ. Once it is
live, set `NEXT_PUBLIC_ORIGIN=https://www.questline.world` and redeploy, so
chronicle permalinks and share cards stop pointing at the `.vercel.app` host.

## Four measured facts about Studio

None of these is guessed, and each one shapes code you will otherwise be tempted
to simplify.

- **IPv6 hangs.** Studio is Cloudflare on both stacks and the AAAA addresses
  time out, so Node - which tries IPv6 first - burns ten seconds per request and
  every server side read looks like a dead network.
  `dns.setDefaultResultOrder("ipv4first")` is set in `next.config.mjs` and in
  every script that reaches the chain, because the config is the earliest module
  the server evaluates and a fix applied later is applied too late.
- **`gen_call` wants the EIP-55 checksummed address.** The all lowercase
  spelling of a live contract answers "Contract not found", and the failure
  looks like an empty world rather than an error. `lib/chain.ts` never
  normalises the configured address and warns on startup if it looks
  unchecksummed. This is the *opposite* of the rule inside the contract, where a
  TreeMap key must be lowercased on both sides.
- **About thirty reads a minute.** The read cache is twenty seconds for that
  reason alone; nothing depends on it for correctness. Each read also carries a
  five second deadline, so a hung socket degrades the page to the seeded world
  rather than to a gateway timeout.
- **A payout never reaches a wallet.** `emit_transfer` is delivered as a
  contract call and an ordinary wallet is not a contract, so the transfer is
  refused as its own transaction: the contract is debited, the payee is not
  credited, and because the transfer fires on finality the verdict cannot roll
  back. `/season` says this out loud rather than printing "paid" over a balance
  that will not move.

## One frontend trap worth knowing

**A `loading.tsx` cannot sit above a route that calls `notFound()`.** A loading
file creates a Suspense boundary, and Next flushes the shell - status line
included - before the page resolves, so `notFound()` can only swap the content
afterwards. The route then answers 200 with not found content, which is a soft
404 a crawler will index. The loading states therefore live on `/play`, `/world`
and `/season` only; `/chronicle/[index]` and `/c/[player]` have none.

## Things that go wrong

**The banner will not go away.** The address is set in the wrong environment, or
you have not redeployed since setting it, or it failed the
`/^0x[0-9a-fA-F]{40}$/` check in `lib/chain.ts` - a trailing space is enough.

**`"live": false` with a timeout.** Studio is rate limited relative to a local
node. The API routes already allow 30 seconds via `maxDuration`; if you are
hitting that, the read cache in `lib/contract.ts` (20 seconds) and the CDN header
on each route are the levers.

**Every write fails but reads work.** The player's wallet is on the wrong chain.
`lib/actions.ts` calls `wallet_switchEthereumChain` and falls back to
`wallet_addEthereumChain` on error 4902, so the usual cause is the user refusing
the switch prompt.

**The contract answers, but nothing can be earned.** The registry is empty -
`add_region` succeeded and `register_items` did not. `/world` says so in red.
Rerun `npm run seed`.

**Changing network after deploying.** Contract addresses are per network.
Flipping `NEXT_PUBLIC_GENLAYER_NETWORK` to `bradbury` without redeploying the
contract points the app at an address that does not exist there.
