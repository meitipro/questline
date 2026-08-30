/**
 * Publish the opening world: the item registry, then the four regions.
 *
 *   $env:QUESTLINE_DEPLOYER_KEY = "0x..."
 *   $env:NEXT_PUBLIC_QUESTLINE_ADDRESS = "0x..."
 *   npm run seed
 *
 * Order matters. The registry goes first, because a region's exits are matched
 * by name and a grant is refused against an empty registry - seeding regions
 * first would leave a window where the world exists and nothing in it can be
 * earned.
 *
 * This is idempotent by construction: register_items skips names it already
 * holds and add_region refuses a duplicate name, so a rerun after a dropped
 * connection finishes the job rather than doubling it.
 */
import dns from "node:dns";

/* Studio's AAAA addresses time out and Node tries IPv6 first, which burns ten
 * seconds per request and reads as the network being down. */
dns.setDefaultResultOrder("ipv4first");

import { createAccount, createClient } from "genlayer-js";
import { studionet, testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

class Abort extends Error {}
const die = (m) => {
  throw new Abort(m);
};

function pickChain() {
  const raw = (process.env.NEXT_PUBLIC_GENLAYER_NETWORK || "studionet")
    .trim()
    .toLowerCase();
  const bradbury =
    raw === "bradbury" || raw === "testnet_bradbury" || raw === "testnetbradbury";
  return bradbury ? testnetBradbury : studionet;
}

/* name=note, separated by semicolons. Semicolons rather than commas because
 * "lantern, wet" is an item name and splitting on commas would invent two. */
const REGISTRY = [
  "rusted bar=bends under load, opens what hands cannot",
  "torn page=half a rule from a version nobody kept",
  "lantern, wet=lights on the third try, or the fourth",
  "brass key=warmer than the water around it",
  "salt rope=sings before it fails, which is a courtesy",
  "tin whistle=opens shutters that are not near you",
  "ledger fragment=a column of numbers and no header",
  "glass float=someone has written a number inside it in salt",
  "ferryman token=passage for one, once, in one direction",
  "a number in salt=not yours, and it knows it",
].join(";");

/* Region zero is where every new player enters, so it is the one that has to be
 * legible with an empty inventory. */
const REGIONS = [
  {
    name: "the sunken archive",
    description:
      "Water has taken the lower shelves. Three doors, one sealed. Fire does nothing here and water damage counts double.",
    rules:
      "Fire effects resolve as none. Water damage counts double. The sealed door opens only to a tool, never to hands. Speech carries, and the archive repeats the last word of anything read aloud.",
    max_magnitude: 4,
    depth: 2,
    exits: "the long stair, the drowned market",
  },
  {
    name: "the long stair",
    description:
      "Two hundred steps with no landing you can trust. What you carry is what you can hold with one hand.",
    rules:
      "Two handed actions resolve at half magnitude. A fall costs health equal to the magnitude rather than granting anything. Nothing can be gained while both hands are occupied.",
    max_magnitude: 3,
    depth: 1,
    exits: "the sunken archive, the ash terrace",
  },
  {
    name: "the ash terrace",
    description:
      "Open sky, and a crust that holds for two paces. The only region where fire behaves as you expect.",
    rules:
      "Fire behaves as expected here and nowhere else. Movement without a rope resolves as damage on a fail. The crust holds two paces, and a third is a fall.",
    max_magnitude: 6,
    depth: 3,
    exits: "the long stair",
  },
  {
    name: "the drowned market",
    description:
      "Stalls under four feet of water and a ferryman who trades in numbers. Speech is an action here.",
    rules:
      "Trades require an item listed in the registry. Speech is an action and costs energy like any other. The ferryman answers a question with a number, never with a name.",
    max_magnitude: 5,
    depth: 4,
    exits: "the sunken archive",
  },
];

async function send(client, label, functionName, args) {
  process.stdout.write(`  ${label}... `);
  try {
    const hash = await client.writeContract({
      address: process.env.NEXT_PUBLIC_QUESTLINE_ADDRESS,
      functionName,
      args,
    });
    await client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
    });
    console.log("accepted");
    return true;
  } catch (e) {
    const message = String(e?.message ?? e);
    // A rerun is expected to hit these, and hitting them means the work is
    // already done rather than that something is broken.
    if (/already exists|already in the world/i.test(message)) {
      console.log("already published, skipped");
      return true;
    }
    console.log("failed");
    console.log(`    ${message}`);
    return false;
  }
}

async function main() {
  const key = process.env.QUESTLINE_DEPLOYER_KEY;
  const address = process.env.NEXT_PUBLIC_QUESTLINE_ADDRESS;
  const chain = pickChain();

  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    die("QUESTLINE_DEPLOYER_KEY must be set to the owner's 32 byte hex private key.");
  }
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    die("NEXT_PUBLIC_QUESTLINE_ADDRESS must be set to the deployed contract.");
  }

  const account = createAccount(key);
  const client = createClient({ chain, account });

  console.log("");
  console.log(`  network     ${chain.name} (chain ${chain.id})`);
  console.log(`  contract    ${address}`);
  console.log(`  owner       ${account.address}`);
  console.log("");
  console.log("  Only the contract owner can publish a world. If this account is");
  console.log("  not the deployer, every call below will be refused.");
  console.log("");

  let ok = await send(client, "item registry", "register_items", [REGISTRY]);

  for (const region of REGIONS) {
    ok =
      (await send(client, `region . ${region.name}`, "add_region", [
        region.name,
        region.description,
        region.rules,
        region.max_magnitude,
        region.depth,
        region.exits,
      ])) && ok;
  }

  console.log("");
  if (ok) {
    console.log("  the world is published");
    console.log("");
    console.log("  Read it back with:  npm run verify");
  } else {
    console.log("  some calls failed. Rerunning is safe: the ones that landed are skipped.");
    process.exitCode = 1;
  }
  console.log("");
}

try {
  await main();
} catch (e) {
  console.error(
    `\n  ${e instanceof Abort ? e.message : e?.shortMessage ?? e?.message ?? e}\n`
  );
  process.exitCode = 1;
}
