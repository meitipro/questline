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

import { OPENING_REGISTRY, OPENING_REGIONS } from "../lib/opening-world.ts";

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
/* One copy, shared with /admin. See lib/opening-world.ts. */
const REGISTRY = OPENING_REGISTRY;

/* Region zero is where every new player enters, so it is the one that has to be
 * legible with an empty inventory. */
const REGIONS = OPENING_REGIONS;

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
  console.log(`  signing as  ${account.address}`);

  /* Ask the contract who owns it BEFORE sending anything.
   *
   * Only the owner may publish a world, and the old version simply printed the
   * account and warned that a wrong one would be refused - so a mismatched key
   * produced five confusing failures in a row, each blaming the method rather
   * than the signer. One read answers it up front, and names both addresses so
   * the difference is visible rather than inferred. */
  let owner = "";
  try {
    const raw = await client.readContract({
      address,
      functionName: "get_world",
      args: [],
    });
    owner = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)).owner ?? "";
  } catch (e) {
    die(
      `Could not read the contract at ${address}.\n` +
        `  ${String(e?.shortMessage ?? e?.message ?? e).split("\n")[0]}\n` +
        "  Check the address, and that it is spelled exactly as deployed."
    );
  }

  console.log(`  owner       ${owner || "(unknown)"}`);
  console.log("");

  if (owner && owner.toLowerCase() !== account.address.toLowerCase()) {
    die(
      "That key is not the contract's owner, so every call below would be refused.\n\n" +
        `  the contract is owned by  ${owner}\n` +
        `  this key signs as         ${account.address}\n\n` +
        "  Use the key of the account that deployed it."
    );
  }

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
