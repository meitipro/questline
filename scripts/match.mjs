/**
 * Does the deployed contract match contracts/questline.py, byte for byte?
 *
 *   npm run match
 *
 * The whole product rests on one claim: the rules that resolved your action are
 * the rules you can read. Publishing the source in a repository does not
 * establish that - it establishes that a file exists. This asks the chain for
 * the bytes it is actually running and compares them to the file, so the claim
 * is checked rather than asserted.
 *
 * The comparison is against the REPOSITORY bytes, not the working copy bytes.
 * This file is checked out CRLF on Windows and LF elsewhere, and the deploy
 * scripts normalise to LF for exactly that reason, so normalising here too is
 * what makes the check give the same answer on every machine. Anything else
 * would report a Windows checkout as a mismatch against a correct deployment.
 *
 * A mismatch is reported by KIND, because the two kinds mean different things:
 *
 *   line endings only   The rules are identical and the deployment carries CR
 *                       bytes the repository does not. It was made before the
 *                       deploy scripts normalised, so nobody can reproduce a
 *                       byte comparison against it. Redeploy.
 *
 *   different source    The deployed contract is not this file. Every sentence
 *                       on the site about readable rules is wrong until the
 *                       address or the file changes.
 *
 * With --lint it also runs genvm-lint over the DEPLOYED bytes rather than over
 * the file on disk. That is a separate question from whether they match, and it
 * is the one a portal review actually asks: a submission has been rejected
 * elsewhere for deployed source failing the linter while the repository version
 * passed cleanly. Linting the repo proves the repo. Only linting what the chain
 * returned proves the deployment.
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import dns from "node:dns";

/* Studio advertises AAAA addresses that time out, and node tries IPv6 first. */
dns.setDefaultResultOrder("ipv4first");

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CONTRACT = join(ROOT, "contracts", "questline.py");

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);

function env(name) {
  for (const file of [".env.local", ".env.e2e", ".env"]) {
    let text;
    try {
      text = readFileSync(join(ROOT, file), "utf8");
    } catch {
      continue;
    }
    for (const line of text.split(LF)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const at = trimmed.indexOf("=");
      if (at > 0 && trimmed.slice(0, at).trim() === name) return trimmed.slice(at + 1).trim();
    }
  }
  return process.env[name] || "";
}

function flag(name) {
  const hit = process.argv.find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.slice(name.length + 3) : "";
}

const address =
  flag("address") ||
  env("NEXT_PUBLIC_QUESTLINE_ADDRESS") ||
  env("QUESTLINE_E2E_ADDRESS");

const rpc = flag("rpc") || env("NEXT_PUBLIC_QUESTLINE_RPC") || "https://studio.genlayer.com/api";

if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
  console.error(
    "  No contract address. Set NEXT_PUBLIC_QUESTLINE_ADDRESS or pass --address=0x..."
  );
  process.exitCode = 2;
}

/**
 * One rpc call, retried.
 *
 * Studio resolves to a pool of edge addresses and node picks ONE per process,
 * so a single unlucky pick reads as the whole network being down. Four attempts
 * with a pause is the difference between a flaky script and a reliable one.
 */
async function call(method, params) {
  let last;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const json = await response.json();
      if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
      return json.result;
    } catch (error) {
      last = error;
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  throw last;
}

/** CR before LF removed, so two files can be compared for their content alone. */
const flatten = (buffer) =>
  Buffer.from(buffer.toString("utf8").split(CR + LF).join(LF), "utf8");

/** Where two buffers first differ, as a line and column in the LOCAL file. */
function firstDifference(local, chain) {
  const limit = Math.min(local.length, chain.length);
  let at = 0;
  while (at < limit && local[at] === chain[at]) at += 1;

  let line = 1;
  let column = 1;
  for (let i = 0; i < at; i += 1) {
    if (local[i] === 10) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { at, line, column };
}

/** The line the difference falls on, so the report names something readable. */
function context(buffer, at) {
  const text = buffer.toString("utf8");
  const from = text.lastIndexOf(LF, at) + 1;
  const to = text.indexOf(LF, at);
  const line = text.slice(from, to === -1 ? text.length : to).trim();
  return line.length > 72 ? line.slice(0, 72) + " ..." : line || "(blank line)";
}

/**
 * genvm-lint over the bytes the chain returned.
 *
 * Written to a real file because the linter takes a path, and named
 * questline.py because the deeper pass loads the module - a different filename
 * changes the module name it reports and, on this linter, whether it finds the
 * contract class at all.
 *
 * The two Windows details from scripts/lint-contract.mjs apply here too: the
 * child needs PYTHONIOENCODING=utf-8 or it dies on the tick it prints for
 * success, and it must never be spawned through a shell or the space in
 * "GenLayer Works" splits the path.
 */
function lintDeployed(bytes) {
  const dir = mkdtempSync(join(tmpdir(), "questline-deployed-"));
  const file = join(dir, "questline.py");
  try {
    writeFileSync(file, bytes);
    console.log("  Linting the deployed bytes, not the file on disk:");
    console.log("");
    const run = spawnSync("genvm-lint", ["check", file], {
      stdio: "inherit",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      shell: false,
    });
    if (run.error) {
      console.error("  Could not run genvm-lint: " + run.error.message);
      console.error("  Install it with:  pip install genvm-linter");
      return 2;
    }
    return run.status ?? 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function show(byte) {
  if (byte === undefined) return "end of file";
  if (byte === 13) return "CR";
  if (byte === 10) return "LF";
  if (byte === 9) return "TAB";
  if (byte >= 32 && byte < 127) return JSON.stringify(String.fromCharCode(byte));
  return "byte " + byte;
}

async function main() {
  if (process.exitCode) return;

  /* LF, matching what the deploy scripts send. Not the working copy's bytes. */
  const local = Buffer.from(
    readFileSync(CONTRACT, "utf8").split(CR + LF).join(LF),
    "utf8"
  );
  const encoded = await call("gen_getContractCode", [address]);
  const chain = Buffer.from(encoded, "base64");

  console.log("");
  console.log("  contract  " + address);
  console.log("  network   " + rpc);
  console.log("  source    " + local.length + " bytes");
  console.log("  deployed  " + chain.length + " bytes");
  console.log("");

  if (local.equals(chain)) {
    console.log("  Match. The deployed bytes are this file.");
    if (process.argv.includes("--lint")) {
      console.log("");
      const status = lintDeployed(chain);
      if (status !== 0) process.exitCode = status;
    }
    return;
  }

  /* Lint the deployed bytes even when they differ, and especially then: a
   * mismatch means the chain is running something this repository does not
   * describe, so what that something does is the more urgent question. */
  if (process.argv.includes("--lint")) {
    const status = lintDeployed(chain);
    if (status !== 0) process.exitCode = status;
    console.log("");
  }

  /* Same source, different platform? Strip CR before LF on both sides and try
   * again. This is checked SECOND, so a real match is never reported through a
   * normalisation - only a mismatch gets explained by one. */
  if (flatten(local).equals(flatten(chain))) {
    console.log("  Mismatch: LINE ENDINGS ONLY. The rules are identical.");
    console.log("");
    console.log("  The deployment carries CR bytes the repository does not, so it was made");
    console.log("  from a Windows checkout before the deploy scripts normalised to LF.");
    console.log("  Nothing is wrong with the rules, but nobody can reproduce a byte");
    console.log("  comparison against this deployment. Redeploy - see .gitattributes.");
    process.exitCode = 1;
    return;
  }

  /* Located in NORMALISED space. A deployment made before the deploy scripts
   * normalised carries a CR on line 1, and comparing raw bytes reported that CR
   * as the difference - burying the actual change hundreds of lines below under
   * a byte offset that matched nothing in either file. */
  const flatLocal = flatten(local);
  const flatChain = flatten(chain);
  const { at, line, column } = firstDifference(flatLocal, flatChain);

  console.log("  Mismatch: DIFFERENT SOURCE.");
  console.log("");
  console.log("  First difference at line " + line + " column " + column + ".");
  console.log("    source    " + show(flatLocal[at]));
  console.log("    deployed  " + show(flatChain[at]));
  console.log("    context   " + context(flatLocal, at));
  if (chain.includes(CR)) {
    console.log("");
    console.log("  The deployment also carries CR bytes the repository does not.");
  }
  console.log("");
  console.log("  The deployed contract is not this file. Either the address points at an");
  console.log("  older deployment, or the file has changed since it was deployed.");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("  " + (error && error.message ? error.message : String(error)));
  process.exitCode = 2;
});
