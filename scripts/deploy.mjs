/**
 * Deploy contracts/questline.py.
 *
 *   $env:QUESTLINE_DEPLOYER_KEY = "0x..."     # PowerShell
 *   npm run deploy
 *
 * The key is read from the environment and never from an argument, because
 * arguments end up in shell history and in the process list. It is never
 * printed, and only the derived address is shown so you can check you are
 * spending from the account you meant to.
 *
 * Deploying creates a permanent record on a public network, so this prints
 * exactly what it is about to do and waits for you to confirm before it sends
 * anything. Pass --yes to skip that in a scripted run.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";

import dns from "node:dns";

/* Studio's AAAA addresses time out and Node tries IPv6 first, which burns ten
 * seconds per request and reads as the network being down. */
dns.setDefaultResultOrder("ipv4first");

import { createAccount, createClient } from "genlayer-js";
import { studionet, testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT = join(HERE, "..", "contracts", "questline.py");

const GEN = 10n ** 18n;

/**
 * Thrown rather than exiting on the spot.
 *
 * process.exit() while the rpc connection is still open trips a libuv assertion
 * on Windows: the script dies with a C level stack trace on top of whatever
 * message it was trying to deliver. Unwinding to one handler and setting
 * exitCode lets node close its own handles and leaves the message last on
 * screen.
 */
class Abort extends Error {}

function die(message) {
  throw new Abort(message);
}

/**
 * The contract source, exactly as the repository stores it.
 *
 * Deploying is the moment the line endings stop being a style question. This
 * working copy is checked out CRLF on Windows and LF everywhere else, and
 * whichever platform ran the deploy is the only platform that can reproduce a
 * byte comparison against it - which is the comparison `npm run match` makes and
 * the one the whole "the rules you can read are the rules that ran" claim rests
 * on. See .gitattributes.
 *
 * So the bytes are normalised to LF before they are sent, on every platform. A
 * deploy from Windows and a deploy from Linux produce the identical contract.
 * Python does not care either way, so nothing about the rules changes.
 */
function sourceForDeploy(path) {
  const CR = String.fromCharCode(13);
  const LF = String.fromCharCode(10);
  return readFileSync(path, "utf8").split(CR + LF).join(LF);
}

function flag(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The same switch lib/chain.ts uses, so a deploy cannot land on a network the site does not read. */
function pickChain() {
  const raw = (process.env.NEXT_PUBLIC_GENLAYER_NETWORK || "studionet")
    .trim()
    .toLowerCase();
  const bradbury =
    raw === "bradbury" || raw === "testnet_bradbury" || raw === "testnetbradbury";
  return bradbury ? testnetBradbury : studionet;
}

/**
 * genlayer-js's deployContract estimates gas itself, and if that single rpc call
 * drops - a lone ECONNRESET - it silently falls back to a hardcoded 200_000 gas
 * rather than retrying. For a contract this size that is not enough, and the
 * chain answers "intrinsic gas too low" before the transaction reaches
 * consensus, so nothing is spent and only the attempt is wasted.
 *
 * There is no public way to hand deployContract a gas value, so the only lever
 * from outside is to retry the whole call on this exact shape of failure. A real
 * contract error looks nothing like this and is left to propagate.
 */
async function deployWithRetry(client, code, args, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await client.deployContract({ code, args });
    } catch (e) {
      const msg = String(e?.message ?? e);
      const starved = /intrinsic gas too low/i.test(msg);
      const flaky = /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(msg);
      if ((starved || flaky) && i < attempts) {
        console.log(
          `  attempt ${i} hit a transient rpc hiccup (${
            starved ? "gas estimation fell back too low" : "connection dropped"
          }), nothing was spent - retrying...`
        );
        await sleep(2000 * i);
        continue;
      }
      throw e;
    }
  }
}

function toWei(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) {
    die(`"${amount}" is not a number of GEN.`);
  }
  // Scaled in two steps rather than Math.round(value * 1e18). The one step
  // version overflows float64's 53 bit mantissa and is silently wrong for about
  // one value in eleven.
  return BigInt(Math.round(value * 1e9)) * (GEN / 10n ** 9n);
}

async function main() {
  const key = process.env.QUESTLINE_DEPLOYER_KEY;
  const chain = pickChain();

  if (!key) {
    die(
      [
        "QUESTLINE_DEPLOYER_KEY is not set.",
        "",
        '  PowerShell:  $env:QUESTLINE_DEPLOYER_KEY = "0x..."',
        "  bash:        export QUESTLINE_DEPLOYER_KEY=0x...",
      ].join("\n")
    );
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    // Deliberately says nothing about what was found, only what is expected.
    die("QUESTLINE_DEPLOYER_KEY is not a 32 byte hex private key (0x + 64 hex).");
  }

  const seasonName = flag("season", "the sunken archive");
  const endsAt = flag("ends", defaultSeasonEnd());
  const passGen = flag("pass", "25");
  const mintGen = flag("mint", "2");

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(endsAt)) {
    die(
      "--ends must look like 2026-08-09T18:00:00 (UTC, no zone marker).\n" +
        "  The contract stores it in exactly that form so string order and time order agree."
    );
  }

  const passWei = toWei(passGen);
  const mintWei = toWei(mintGen);

  const code = sourceForDeploy(CONTRACT);
  const account = createAccount(key);
  const client = createClient({ chain, account });

  /* Read before the confirmation prompt rather than after it. On Bradbury an
   * unfunded account fails somewhere inside the send with a message about gas
   * that reads like the contract is broken. Studio reports a zero balance for
   * every ordinary address and charges nothing, so a zero there is not an
   * error - which is why this reports the number and only refuses on a network
   * that actually needs it. */
  let balance = null;
  try {
    balance = await client.getBalance({ address: account.address });
  } catch (e) {
    die(
      `Could not reach ${chain.rpcUrls.default.http[0]} to read the balance.\n` +
        `  ${e?.shortMessage ?? e?.message ?? e}`
    );
  }

  const isStudio = chain.id === studionet.id;
  if (balance === 0n && !isStudio) {
    die(
      [
        `${account.address} holds no GEN, so the deployment would fail.`,
        "",
        "  Fund it from the faucet, then run this again:",
        "  https://testnet-faucet.genlayer.foundation/",
      ].join("\n")
    );
  }

  console.log("");
  console.log("  contract    contracts/questline.py");
  console.log(`  bytes       ${code.length.toLocaleString("en-US")}`);
  console.log(`  network     ${chain.name} (chain ${chain.id})`);
  console.log(`  rpc         ${chain.rpcUrls.default.http[0]}`);
  console.log(`  deployer    ${account.address}`);
  console.log(
    `  balance     ${Number((balance * 10000n) / GEN) / 10000} GEN${
      balance === 0n && isStudio ? "  (expected on Studio, which charges nothing)" : ""
    }`
  );
  console.log(`  season      ${seasonName}`);
  console.log(`  ends        ${endsAt}Z`);
  console.log(`  pass        ${passGen} GEN  (${passWei} wei)`);
  console.log(`  mint fee    ${mintGen} GEN  (${mintWei} wei)`);
  console.log("");

  if (!process.argv.includes("--yes")) {
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question("  Deploy this? Type yes to continue: ");
    rl.close();
    if (answer.trim().toLowerCase() !== "yes") die("Nothing was deployed.");
  }

  console.log("\n  deploying...");
  const hash = await deployWithRetry(client, code, [
    seasonName,
    endsAt,
    passWei,
    mintWei,
  ]);

  console.log(`  tx          ${hash}`);
  console.log("  waiting for the network to accept it...");
  const accepted = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });

  const address =
    accepted?.data?.contract_address ??
    accepted?.contract_address ??
    accepted?.result?.contract_address;

  if (!address) {
    console.error("\n  Accepted, but no contract address came back on the receipt.");
    console.error(JSON.stringify(accepted, null, 2).slice(0, 2000));
    die("Could not read the deployed address.");
  }

  console.log("  waiting for finality...");
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
  });

  console.log("");
  console.log("  deployed");
  console.log(`  address     ${address}`);
  console.log("");
  console.log("  Next, publish the opening world:");
  console.log("");
  console.log(`    $env:NEXT_PUBLIC_QUESTLINE_ADDRESS = "${address}"`);
  console.log("    npm run seed");
  console.log("");
  console.log("  Then set this in .env.local and in Vercel:");
  console.log("");
  console.log(`  NEXT_PUBLIC_QUESTLINE_ADDRESS=${address}`);
  console.log("");
  console.log("  The demonstration banner disappears on its own once that is set.");
  console.log("");
}

/** Four weeks out, on the hour, which is a sane opening season length. */
function defaultSeasonEnd() {
  const end = new Date(Date.now() + 28 * 86400000);
  end.setUTCMinutes(0, 0, 0);
  return end.toISOString().slice(0, 19);
}

try {
  await main();
} catch (e) {
  console.error(
    `\n  ${e instanceof Abort ? e.message : e?.shortMessage ?? e?.message ?? e}\n`
  );
  process.exitCode = 1;
}
