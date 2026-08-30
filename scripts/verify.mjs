/**
 * Read the live contract and check it against the app's own arithmetic.
 *
 *   $env:NEXT_PUBLIC_QUESTLINE_ADDRESS = "0x..."
 *   npm run verify
 *
 * This is not a smoke test of the rpc. It reads the world, then takes the
 * newest chronicle lines and recomputes every roll from the line's own public
 * fields, and asks the contract to recompute one too. If the three ever
 * disagree - the stored roll, this script's sha256, and verify_roll on chain -
 * then the central claim of the product is false and this is where it shows up.
 */
import { createHash } from "node:crypto";

import dns from "node:dns";

/* Studio's AAAA addresses time out and Node tries IPv6 first, which burns ten
 * seconds per request and reads as the network being down. */
dns.setDefaultResultOrder("ipv4first");

import { createClient } from "genlayer-js";
import { studionet, testnetBradbury } from "genlayer-js/chains";

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

/** The published recipe, implemented here from scratch rather than imported. */
function roll(at, who, index) {
  const seed = `${at}|${String(who).toLowerCase()}|${index}`;
  const digest = createHash("sha256").update(seed, "utf8").digest();
  return (((digest[0] << 8) | digest[1]) % 20) + 1;
}

async function view(client, address, functionName, args = []) {
  const raw = await client.readContract({ address, functionName, args });
  return typeof raw === "string" ? raw : JSON.stringify(raw);
}

async function main() {
  const address = process.env.NEXT_PUBLIC_QUESTLINE_ADDRESS;
  const chain = pickChain();

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    die("NEXT_PUBLIC_QUESTLINE_ADDRESS must be set to the deployed contract.");
  }

  const client = createClient({ chain });

  console.log("");
  console.log(`  network     ${chain.name} (chain ${chain.id})`);
  console.log(`  contract    ${address}`);

  const world = JSON.parse(await view(client, address, "get_world"));
  console.log("");
  console.log(`  season      ${world.season.number} . ${world.season.name}`);
  console.log(`  ends        ${world.season.ends}Z`);
  console.log(`  pool        ${BigInt(world.season.pool) / 10n ** 18n} GEN`);
  console.log(`  regions     ${world.counts.regions}`);
  console.log(`  registry    ${world.counts.items} items`);
  console.log(`  players     ${world.counts.players}`);
  console.log(`  actions     ${world.counts.actions}`);

  for (const region of world.regions) {
    console.log(
      `    ${region.name} . rules v${region.rules_version} . cap ${region.max_magnitude} . depth ${region.depth}`
    );
  }

  if (world.counts.regions === 0) {
    console.log("");
    console.log("  No regions yet, so nothing can be resolved. Run: npm run seed");
    console.log("");
    return;
  }

  const page = JSON.parse(await view(client, address, "get_chronicle", [0, 10]));
  console.log("");
  console.log(`  chronicle   ${page.total} lines, ${page.lines.length} read`);

  if (page.lines.length === 0) {
    console.log("");
    console.log("  Nothing has been resolved yet, so there are no rolls to verify.");
    console.log("");
    return;
  }

  let bad = 0;
  for (const line of page.lines) {
    const mine = roll(line.at, line.who, line.index);
    const agrees = mine === line.roll;
    if (!agrees) bad++;
    console.log(
      `    line ${line.index} . stored ${line.roll} . recomputed ${mine} ${
        agrees ? "." : "<-- DISAGREES"
      } ${line.band}`
    );
  }

  // And once more through the contract, so the check does not rest on one
  // implementation of sha256 agreeing with itself.
  const sample = page.lines[0];
  const onChain = Number(
    JSON.parse(await view(client, address, "verify_roll", [sample.at, sample.who, sample.index]))
  );
  const onChainAgrees = onChain === sample.roll;
  if (!onChainAgrees) bad++;

  console.log("");
  console.log(
    `  verify_roll on chain for line ${sample.index}: ${onChain} ${
      onChainAgrees ? "agrees" : "DISAGREES with the stored roll"
    }`
  );

  console.log("");
  if (bad === 0) {
    console.log("  every roll read back verifies from public data");
  } else {
    console.log(`  ${bad} disagreement(s). That should be impossible - investigate before playing.`);
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
