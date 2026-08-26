/**
 * Owner-only world administration: revise a region, close a season, open the
 * next one.
 *
 *   $env:QUESTLINE_DEPLOYER_KEY = "0x..."
 *   $env:NEXT_PUBLIC_QUESTLINE_ADDRESS = "0x..."
 *
 *   node scripts/admin.mjs status
 *   node scripts/admin.mjs revise --region=1 --cap=4 --rules="..."
 *   node scripts/admin.mjs close-season
 *   node scripts/admin.mjs open-season --name="the ash terrace" --ends=2026-10-01T18:00:00
 *
 * These are the three methods the site deliberately has no button for. Revising
 * a region changes what every future action is judged against, and closing a
 * season moves the pool; neither belongs behind a click in a web page that a
 * misplaced tap can reach. They live here, they print what they are about to do,
 * and they wait for a typed confirmation.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

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

const GEN = 10n ** 18n;

function flag(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function pickChain() {
  const raw = (process.env.NEXT_PUBLIC_GENLAYER_NETWORK || "studionet")
    .trim()
    .toLowerCase();
  const bradbury =
    raw === "bradbury" || raw === "testnet_bradbury" || raw === "testnetbradbury";
  return bradbury ? testnetBradbury : studionet;
}

async function confirm(question) {
  if (process.argv.includes("--yes")) return;
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(`  ${question} Type yes to continue: `);
  rl.close();
  if (answer.trim().toLowerCase() !== "yes") die("Nothing was sent.");
}

async function view(client, address, fn, args = []) {
  const raw = await client.readContract({ address, functionName: fn, args });
  return typeof raw === "string" ? raw : JSON.stringify(raw);
}

async function send(client, address, fn, args, waitFinal = false) {
  const hash = await client.writeContract({ address, functionName: fn, args });
  console.log(`  tx          ${hash}`);
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });
  console.log("  accepted");
  if (waitFinal) {
    console.log("  waiting for finality...");
    await client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.FINALIZED,
    });
    console.log("  finalized");
  }
  return hash;
}

async function main() {
  const command = process.argv[2];
  const address = process.env.NEXT_PUBLIC_QUESTLINE_ADDRESS;
  const chain = pickChain();

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    die("NEXT_PUBLIC_QUESTLINE_ADDRESS must be set to the deployed contract.");
  }
  if (!command || command === "help") {
    die(
      [
        "Usage:",
        "  node scripts/admin.mjs status",
        "  node scripts/admin.mjs revise --region=<index> --cap=<1-10> --rules=\"...\"",
        "  node scripts/admin.mjs close-season",
        "  node scripts/admin.mjs open-season --name=\"...\" --ends=YYYY-MM-DDTHH:MM:SS [--pass=25] [--mint=2]",
      ].join("\n")
    );
  }

  // status needs no key, and is the one worth running before anything else.
  if (command === "status") {
    const client = createClient({ chain });
    const world = JSON.parse(await view(client, address, "get_world"));
    console.log("");
    console.log(`  network     ${chain.name} (chain ${chain.id})`);
    console.log(`  contract    ${address}`);
    console.log(`  owner       ${world.owner}`);
    console.log(`  season      ${world.season.number} . ${world.season.name}`);
    console.log(`  ends        ${world.season.ends}Z`);
    console.log(`  closed      ${world.season.closed}`);
    console.log(`  pool        ${BigInt(world.season.pool) / GEN} GEN`);
    console.log("");
    for (const r of world.regions) {
      console.log(
        `  [${r.index}] ${r.name} . rules v${r.rules_version} . cap ${r.max_magnitude} . depth ${r.depth}`
      );
    }
    console.log("");
    return;
  }

  const key = process.env.QUESTLINE_DEPLOYER_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    die("QUESTLINE_DEPLOYER_KEY must be set to the owner's 32 byte hex private key.");
  }
  const account = createAccount(key);
  const client = createClient({ chain, account });

  console.log("");
  console.log(`  network     ${chain.name} (chain ${chain.id})`);
  console.log(`  contract    ${address}`);
  console.log(`  as          ${account.address}`);

  if (command === "revise") {
    const index = Number(flag("region", ""));
    const cap = Number(flag("cap", ""));
    const rules = flag("rules", "");

    if (!Number.isInteger(index) || index < 0) die("--region must be a region index.");
    if (!Number.isInteger(cap) || cap < 1 || cap > 10) die("--cap must be 1 to 10.");
    if (rules.trim().length < 10) die("--rules must be the full replacement rules text.");

    const world = JSON.parse(await view(client, address, "get_world"));
    const region = world.regions[index];
    if (!region) die(`No region at index ${index}. Run: node scripts/admin.mjs status`);

    console.log("");
    console.log(`  region      [${index}] ${region.name}`);
    console.log(`  version     v${region.rules_version} -> v${region.rules_version + 1}`);
    console.log(`  cap         ${region.max_magnitude} -> ${cap}`);
    console.log("");
    console.log("  current rules:");
    console.log(`    ${region.rules}`);
    console.log("");
    console.log("  new rules:");
    console.log(`    ${rules}`);
    console.log("");
    console.log("  Every chronicle line already stores the version it ran under, so");
    console.log("  this does not change how past actions read. It changes what every");
    console.log("  FUTURE action in this region is judged against.");
    console.log("");

    await confirm("Publish this new rules version?");
    await send(client, address, "revise_region", [index, rules, cap]);
    console.log("\n  published. /world will show v" + (region.rules_version + 1) + ".\n");
    return;
  }

  if (command === "close-season") {
    const world = JSON.parse(await view(client, address, "get_world"));
    const board = JSON.parse(await view(client, address, "get_leaderboard", [3]));
    const pool = BigInt(world.season.pool);

    console.log("");
    console.log(`  season      ${world.season.number} . ${world.season.name}`);
    console.log(`  ends        ${world.season.ends}Z`);
    console.log(`  pool        ${pool / GEN} GEN`);
    console.log("");
    if (board.rows.length === 0) {
      console.log("  Nobody placed, so nothing is paid and the pool CARRIES into");
      console.log("  the next season rather than being cleared. A pool can be");
      console.log("  non-empty with no ranking, because item mint fees are paid in");
      console.log("  by players who never bought a pass.");
    } else {
      const shares =
        board.rows.length === 1 ? [100] : board.rows.length === 2 ? [60, 40] : [50, 30, 20];
      console.log("  would pay:");
      board.rows.slice(0, shares.length).forEach((row, i) => {
        console.log(
          `    ${i + 1}. ${row.address}  ${shares[i]}%  ~${(pool * BigInt(shares[i])) / 100n / GEN} GEN`
        );
      });
    }
    console.log("");
    if (chain.id === studionet.id) {
      console.log("  NOTE: on Studio the emitted transfer is delivered as a contract");
      console.log("  call and an ordinary wallet is not a contract, so it is refused as");
      console.log("  its own transaction. The contract is debited and the payee is NOT");
      console.log("  credited. The season really closes; nobody gets richer.");
      console.log("");
    }
    console.log("  This is irreversible. The season cannot be reopened.");
    console.log("");

    await confirm("Close the season and pay out?");
    await send(client, address, "close_season", [], true);
    console.log("\n  closed.\n");
    return;
  }

  if (command === "open-season") {
    const name = flag("name", "");
    const ends = flag("ends", "");
    const pass = flag("pass", "25");
    const mint = flag("mint", "2");

    if (!name.trim()) die("--name is required.");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(ends)) {
      die("--ends must look like 2026-10-01T18:00:00 (UTC, no zone marker).");
    }
    const passWei = BigInt(Math.round(Number(pass) * 1e9)) * (GEN / 10n ** 9n);
    const mintWei = BigInt(Math.round(Number(mint) * 1e9)) * (GEN / 10n ** 9n);

    console.log("");
    console.log(`  name        ${name}`);
    console.log(`  ends        ${ends}Z`);
    console.log(`  pass        ${pass} GEN`);
    console.log(`  mint fee    ${mint} GEN`);
    console.log("");
    console.log("  The contract refuses this unless the current season is closed,");
    console.log("  because bumping the number while one is open would orphan its pool.");
    console.log("");

    await confirm("Open this season?");
    await send(client, address, "open_season", [name, ends, passWei, mintWei]);
    console.log("\n  open.\n");
    return;
  }

  die(`Unknown command "${command}". Run: node scripts/admin.mjs help`);
}

try {
  await main();
} catch (e) {
  console.error(
    `\n  ${e instanceof Abort ? e.message : e?.shortMessage ?? e?.message ?? e}\n`
  );
  process.exitCode = 1;
}
