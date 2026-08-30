/**
 * End to end on a real network, with a throwaway account.
 *
 *   npm run e2e
 *
 * This exists because four things in this project were only ever "logically
 * correct": the comparative validator actually reaching consensus, the
 * absent/unavailable classifier against real genlayer-js errors, verify_roll on
 * chain, and whether a 54KB contract deploys at all. None can be proven by a
 * unit test, and all are the kind of thing that surprises you on the first real
 * transaction.
 *
 * It generates its own key and funds it through Studio's programmatic faucet, so
 * it never touches the operator's account. The key and address are written to
 * .env.e2e (gitignored) so a failed run resumes with --address=0x...
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const RPC = studionet.rpcUrls.default.http[0];
const GEN = 10n ** 18n;

const flag = (n, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (s) => console.log(`\n== ${s}`);
const ok = (s) => console.log(`  ok    ${s}`);
const info = (s) => console.log(` . ${s}`);

let failures = 0;
function expect(label, cond, detail = "") {
  if (cond) ok(label);
  else {
    console.log(`  FAIL  ${label} ${detail}`);
    failures++;
  }
}

/**
 * One json-rpc call, retried on a connection that never opened.
 *
 * Studio sits behind Cloudflare and resolves to several edge addresses, and
 * Node's fetch picks one and stays with it. When that one is unreachable the
 * call dies with a bare "fetch failed" whose cause is `Connect Timeout Error
 * (attempted addresses: 188.114.99.0:443)` while curl, which tries the others,
 * succeeds against the same hostname in the same second.
 *
 * That is not a failure worth aborting an end to end run over, and it read as
 * one: the faucet step is the second thing this script does, so a single
 * unlucky address made the whole proof look broken. Retrying re-resolves and
 * usually lands on a different edge.
 */
async function rpc(method, params, attempts = 12) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      return await res.json();
    } catch (e) {
      last = e;
      const why = String(e?.cause?.message ?? e?.message ?? e);
      if (i < attempts) {
        console.log(`  . ${method} could not connect (${why}), retry ${i}`);
        await sleep(1500 * i);
        continue;
      }
    }
  }
  throw last;
}

/** Studio drops TLS connections often, so every write gets a few attempts. */
async function retry(label, fn, attempts = 10) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = String(e?.message ?? e);
      const transient =
        /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|terminated|intrinsic gas|timeout/i.test(
          msg
        );
      if (i < attempts && transient) {
        info(`${label}: transient (${msg.slice(0, 60)}), retry ${i}`);
        await sleep(Math.min(3000 * i, 12000));
        continue;
      }
      throw e;
    }
  }
  throw last;
}

/** The published recipe, reimplemented so this script is an independent witness. */
function rollOf(at, who, index) {
  const d = createHash("sha256")
    .update(`${at}|${String(who).toLowerCase()}|${index}`, "utf8")
    .digest();
  return (((d[0] << 8) | d[1]) % 20) + 1;
}

const view = async (client, address, fn, args = []) => {
  const raw = await retry(`view ${fn}`, () =>
    client.readContract({ address, functionName: fn, args })
  );
  return typeof raw === "string" ? raw : JSON.stringify(raw);
};

/**
 * ACCEPTED is not success.
 *
 * A receipt has three fields that all read like success: `status` is the
 * transaction's state, `result` is the consensus outcome, and only
 * consensus_data.leader_receipt[].execution_result says whether the contract's
 * own code ran. The first version of this script waited for ACCEPTED and
 * reported a pass, so a leader that died inside `act` looked like a turn that
 * worked and the failure only showed up three assertions later as "no chronicle
 * line". Hours, in the wrong direction.
 */
function assertExecuted(receipt, what) {
  const rounds =
    receipt?.consensus_data?.leader_receipt ??
    receipt?.data?.consensus_data?.leader_receipt;
  if (!Array.isArray(rounds) || rounds.length === 0) return;
  const leader = rounds.find((r) => r?.mode === "leader") ?? rounds[0];
  if (leader?.execution_result === undefined) return;
  if (leader.execution_result === "SUCCESS") return;

  const payload = leader?.result?.payload;
  const stderr = leader?.genvm_result?.stderr;
  const detail =
    (typeof payload === "string" && payload.trim()) ||
    (typeof stderr === "string" && stderr.trim().split(String.fromCharCode(10)).slice(-3).join(" ")) ||
    leader.execution_result;
  throw new Error(`${what} did not execute: ${detail}`);
}

async function write(client, address, fn, args, label, final = false) {
  const hash = await retry(label, () =>
    client.writeContract({ address, functionName: fn, args })
  );
  const accepted = await retry(`${label} receipt`, () =>
    client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED })
  );
  assertExecuted(accepted, label);
  if (final) {
    await retry(`${label} finality`, () =>
      client.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED })
    );
  }
  return hash;
}

const REGISTRY = [
  "rusted bar=bends under load, opens what hands cannot",
  "torn page=half a rule from a version nobody kept",
  "lantern, wet=lights on the third try, or the fourth",
  "brass key=warmer than the water around it",
  "salt rope=sings before it fails, which is a courtesy",
].join(";");

const REGIONS = [
  [
    "the sunken archive",
    "Water has taken the lower shelves. Three doors, one sealed. Fire does nothing here and water damage counts double.",
    "Fire effects resolve as none. Water damage counts double. The sealed door opens only to a tool, never to hands.",
    4,
    2,
    "the long stair",
  ],
  [
    "the long stair",
    "Two hundred steps with no landing you can trust. What you carry is what you can hold with one hand.",
    "Two handed actions resolve at half magnitude. A fall costs health equal to the magnitude rather than granting anything.",
    3,
    1,
    "the sunken archive",
  ],
];

async function main() {
  console.log(`\n  network   ${studionet.name} (chain ${studionet.id})`);
  console.log(`  rpc       ${RPC}`);

  // ---------- account ----------
  step("1. a throwaway account");
  let key = flag("key", process.env.QUESTLINE_E2E_KEY);
  if (!key) {
    key =
      "0x" +
      createHash("sha256")
        .update(String(Date.now()) + Math.random())
        .digest("hex");
    writeFileSync(join(ROOT, ".env.e2e"), `QUESTLINE_E2E_KEY=${key}\n`, "utf8");
    info("generated, saved to .env.e2e (gitignored)");
  }
  const account = createAccount(key);
  console.log(`  address   ${account.address}`);

  const funded = await rpc("sim_fundAccount", [
    account.address,
    Number(500n * GEN),
  ]);
  expect(
    "funded through sim_fundAccount",
    !funded.error,
    JSON.stringify(funded.error ?? "")
  );
  await sleep(3000);

  const client = createClient({ chain: studionet, account });

  // ---------- deploy ----------
  step("2. deploy the contract");
  let address = flag("address", process.env.QUESTLINE_E2E_ADDRESS || "");
  if (!address) {
    const code = readFileSync(join(ROOT, "contracts", "questline.py"), "utf8");
    info(`${code.length.toLocaleString("en-US")} bytes of contract`);
    const ends = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 19);
    const hash = await retry("deploy", () =>
      client.deployContract({
        code,
        args: ["the sunken archive", ends, 25n * GEN, 2n * GEN],
      })
    );
    console.log(`  tx        ${hash}`);
    const accepted = await retry("deploy receipt", () =>
      client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
      })
    );
    address =
      accepted?.data?.contract_address ??
      accepted?.contract_address ??
      accepted?.result?.contract_address;
    expect("a contract address came back", Boolean(address));
    if (!address) throw new Error("no address on the receipt");
    await retry("deploy finality", () =>
      client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.FINALIZED,
      })
    );
    appendFileSync(
      join(ROOT, ".env.e2e"),
      `QUESTLINE_E2E_ADDRESS=${address}\n`,
      "utf8"
    );
  }
  console.log(`  contract  ${address}`);

  const codeBack = await rpc("gen_getContractCode", [address]);
  expect(
    "gen_getContractCode reads the deployed code back",
    Boolean(codeBack.result),
    JSON.stringify(codeBack.error ?? "")
  );

  // ---------- seed ----------
  step("3. publish a world");
  await write(client, address, "register_items", [REGISTRY], "registry");
  ok("item registry");
  for (const r of REGIONS) {
    await write(client, address, "add_region", r, `region ${r[0]}`);
    ok(`region . ${r[0]}`);
  }

  const world = JSON.parse(await view(client, address, "get_world"));
  expect(
    "get_world returns the regions",
    world.regions.length === REGIONS.length,
    `got ${world.regions.length}`
  );
  expect(
    "get_world returns the registry",
    world.counts.items === 5,
    `got ${world.counts.items}`
  );
  expect(
    "get_world publishes the criteria the validators were given",
    Array.isArray(world.adjudication?.criteria) &&
      world.adjudication.criteria.length >= 9,
    `got ${world.adjudication?.criteria?.length}`
  );

  // ---------- enter ----------
  step("4. enter the world");
  await write(client, address, "enter", [], "enter");
  const me = JSON.parse(
    await view(client, address, "get_player", [account.address])
  );
  expect("the player exists", me.exists === true);
  expect(
    "energy starts full",
    me.energy === world.rules.max_energy,
    `got ${me.energy}`
  );
  expect(
    "health starts full",
    me.health === world.rules.max_health,
    `got ${me.health}`
  );

  // ---------- the real test ----------
  step("5. act - the comparative validator, on real validators");
  info("the one thing no unit test can reach: several validators each resolve");
  info("the action independently and must agree on the state change");
  const t0 = Date.now();
  await write(
    client,
    address,
    "act",
    ["pry the seal with the rusted bar"],
    "act"
  );
  info(`resolved in ${Math.round((Date.now() - t0) / 1000)}s`);

  const page = JSON.parse(await view(client, address, "get_chronicle", [0, 10]));
  expect(
    "a chronicle line was written",
    page.lines.length === 1,
    `got ${page.lines.length}`
  );
  const line = page.lines[0];
  if (line) {
    console.log(`\n  narration  ${line.text}`);
    console.log(`  roll       ${line.roll} of 20 . ${line.band}`);
    console.log(
      `  effect     ${line.effect}${line.target ? " . " + line.target : ""}`
    );
    console.log(
      `  magnitude  ${line.magnitude} (band cap ${line.band_cap}, region ${line.region_cap})\n`
    );

    expect(
      "the roll is on the die",
      line.roll >= 1 && line.roll <= 20,
      `got ${line.roll}`
    );
    const mine = rollOf(line.at, line.who, line.index);
    expect(
      "this script recomputes the same roll",
      mine === line.roll,
      `stored ${line.roll}, computed ${mine}`
    );

    const onChain = Number(
      JSON.parse(
        await view(client, address, "verify_roll", [
          line.at,
          line.who,
          line.index,
        ])
      )
    );
    expect(
      "verify_roll on chain agrees",
      onChain === line.roll,
      `chain ${onChain}, stored ${line.roll}`
    );

    expect(
      "magnitude respects the band cap",
      line.magnitude <= line.band_cap,
      `${line.magnitude} > ${line.band_cap}`
    );
    const FAIL_ONLY = ["none", "damage", "lose_item"];
    if (line.band === "fail") {
      expect(
        "a failed roll granted nothing",
        FAIL_ONLY.includes(line.effect),
        `effect was ${line.effect}`
      );
    }
    if (line.effect === "gain_item") {
      expect(
        "a granted item is in the registry",
        world.registry.some((i) => i.name === line.target),
        `granted ${line.target}`
      );
    }
    if (line.effect === "move") {
      expect(
        "a move names a published exit",
        world.regions.some((r) => r.name === line.target),
        `moved to ${line.target}`
      );
    }
  }

  const after = JSON.parse(
    await view(client, address, "get_player", [account.address])
  );
  expect(
    "energy was spent exactly once",
    after.energy === me.energy - 1,
    `${me.energy} -> ${after.energy}`
  );
  expect("the action counter moved", after.actions === 1, `got ${after.actions}`);

  // ---------- what a real refusal looks like ----------
  step("6. the shape of a real 'no such line' error");
  info("lib/absence.ts guesses at this shape; here is the real one");
  try {
    await client.readContract({
      address,
      functionName: "get_line",
      args: [9999],
    });
    console.log("  FAIL  reading a missing line did not raise");
    failures++;
  } catch (e) {
    const msg = String(e?.shortMessage ?? e?.message ?? e);
    console.log(`  raw       ${msg.slice(0, 240)}`);
    try {
      const mod = await import(
        pathToFileURL(join(ROOT, ".e2e-build", "absence.js")).href
      );
      expect(
        "lib/absence.ts classifies it as absent, so the page 404s correctly",
        mod.saysNoSuchLine(msg) === true,
        "-> it would render a retry instead, which is safe but wrong here"
      );
    } catch {
      info("compile lib/absence.ts into .e2e-build to check the classifier");
    }
  }

  step("result");
  console.log(`  contract  ${address}`);
  console.log(`  point the site at it with:`);
  console.log(`  NEXT_PUBLIC_QUESTLINE_ADDRESS=${address}\n`);
  if (failures) {
    console.log(`  ${failures} check(s) failed\n`);
    process.exitCode = 1;
  } else {
    console.log(`  every check passed\n`);
  }
}

main().catch((e) => {
  console.error(`\n  aborted: ${e?.shortMessage ?? e?.message ?? e}\n`);
  process.exitCode = 1;
});
