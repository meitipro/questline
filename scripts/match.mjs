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
 * A mismatch is reported by KIND, because the two kinds mean different things:
 *
 *   line endings only   The source is identical and one side was written on a
 *                       different platform. Nothing is wrong with the rules,
 *                       but the deployed bytes are not the repository bytes, so
 *                       nobody can reproduce a byte comparison. This is what
 *                       .gitattributes exists to prevent.
 *
 *   different source    The deployed contract is not this file. Every sentence
 *                       on the site about readable rules is wrong until the
 *                       address or the file changes.
 */

import { readFileSync } from "node:fs";
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

  const local = readFileSync(CONTRACT);
  const encoded = await call("gen_getContractCode", [address]);
  const chain = Buffer.from(encoded, "base64");

  console.log("");
  console.log("  contract  " + address);
  console.log("  network   " + rpc);
  console.log("  local     " + local.length + " bytes");
  console.log("  deployed  " + chain.length + " bytes");
  console.log("");

  if (local.equals(chain)) {
    console.log("  Match. The deployed bytes are this file.");
    return;
  }

  /* Same source, different platform? Strip CR before LF on both sides and try
   * again. This is checked SECOND, so a real match is never reported through a
   * normalisation - only a mismatch gets explained by one. */
  const flatten = (buffer) =>
    Buffer.from(buffer.toString("utf8").split(CR + LF).join(LF), "utf8");

  if (flatten(local).equals(flatten(chain))) {
    const localCRLF = local.includes(CR + LF);
    console.log("  Mismatch: LINE ENDINGS ONLY. The rules are identical.");
    console.log("");
    console.log(
      "  The file on disk uses " +
        (localCRLF ? "CRLF" : "LF") +
        " and the deployed bytes use " +
        (localCRLF ? "LF" : "CRLF") +
        "."
    );
    console.log("  Nobody can reproduce a byte comparison against this deployment, so");
    console.log("  redeploy from an LF checkout - see .gitattributes for why LF.");
    process.exitCode = 1;
    return;
  }

  const { at, line, column } = firstDifference(local, chain);
  console.log("  Mismatch: DIFFERENT SOURCE.");
  console.log("");
  console.log("  First difference at byte " + at + ", line " + line + " column " + column + ".");
  console.log("    local     " + show(local[at]));
  console.log("    deployed  " + show(chain[at]));
  console.log("");
  console.log("  The deployed contract is not this file. Either the address points at an");
  console.log("  older deployment, or the file has changed since it was deployed.");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("  " + (error && error.message ? error.message : String(error)));
  process.exitCode = 2;
});
