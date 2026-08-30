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

Eighty files. `.gitignore` keeps `node_modules`, `.next`, `.env*`, `.claude/`
and this folder's launch material out, so `.env.example` is the only env file
tracked and every value in it is empty. Worth re-checking before any push that
adds files:

```bash
git ls-files | Select-String -Pattern "env|key|pem"
```

That should print nothing but `.env.example`.

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

## Things that go wrong

**The banner will not go away.** The address is set in the wrong environment, or
you have not redeployed since setting it, or it failed the
`/^0x[0-9a-fA-F]{40}$/` check in `lib/chain.ts` - a trailing space is enough.

**`"live": false` with a timeout.** Studio is rate limited relative to a local
node. The API routes already allow 30 seconds via `maxDuration`; if you are
hitting that, the read cache in `lib/contract.ts` (4 seconds) and the CDN header
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
