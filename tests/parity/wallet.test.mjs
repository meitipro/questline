/**
 * Moving a wallet onto the right network.
 *
 *   npm test
 *
 * "WRONG NETWORK" used to be red text and nothing else. The interface had
 * correctly worked out that every write would fail, said so, and then left the
 * reader to find the network switcher in their extension and type a chain id
 * from memory. Naming a problem is not solving it.
 *
 * The branch that actually matters is 4902. Studio is not a network any wallet
 * ships with, so for almost every first-time visitor the switch request FAILS
 * and the add request is what succeeds - the fallback is the normal path here,
 * not the edge case. It cannot be exercised in a browser without a real
 * extension on a real wrong network, so it is exercised against a fake provider
 * instead, which is the whole reason the logic lives outside the hook.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { revokeAccess, switchToNetwork } from "../../lib/actions.ts";

/** A wallet that answers however the test says, and records what it was asked. */
function wallet(behaviour) {
  const calls = [];
  return {
    calls,
    async request({ method, params }) {
      calls.push(method);
      const answer = behaviour[method];
      if (typeof answer === "function") return answer(params);
      return answer ?? null;
    },
  };
}

function rejection(code, nested = false) {
  return () => {
    const e = new Error("chain not recognised");
    if (nested) e.data = { originalError: { code } };
    else e.code = code;
    throw e;
  };
}

test("a wallet that already knows the network just switches", async () => {
  const w = wallet({ wallet_switchEthereumChain: null });
  assert.equal(await switchToNetwork(w), true);
  assert.deepEqual(w.calls, ["wallet_switchEthereumChain"]);
});

test("a wallet that has never heard of the network is offered it", async () => {
  // The normal path for Studio, not the exception.
  const w = wallet({
    wallet_switchEthereumChain: rejection(4902),
    wallet_addEthereumChain: null,
  });
  assert.equal(await switchToNetwork(w), true);
  assert.deepEqual(w.calls, ["wallet_switchEthereumChain", "wallet_addEthereumChain"]);
});

test("and when the wallet buries the code under data.originalError", async () => {
  // Some wallets nest it. Miss this and every first-time visitor on that wallet
  // gets a dead end exactly where the app should have offered to add the chain.
  const w = wallet({
    wallet_switchEthereumChain: rejection(4902, true),
    wallet_addEthereumChain: null,
  });
  assert.equal(await switchToNetwork(w), true);
  assert.deepEqual(w.calls, ["wallet_switchEthereumChain", "wallet_addEthereumChain"]);
});

test("a refusal that is NOT 4902 is not answered by adding a chain", async () => {
  // 4001 is the user clicking reject. Following that with "then let me add a
  // network" is the behaviour of something trying to get past them.
  const w = wallet({ wallet_switchEthereumChain: rejection(4001) });
  await assert.rejects(() => switchToNetwork(w));
  assert.deepEqual(w.calls, ["wallet_switchEthereumChain"], "must not try to add a chain");
});

test("a refused add surfaces the wallet's own error", async () => {
  const w = wallet({
    wallet_switchEthereumChain: rejection(4902),
    wallet_addEthereumChain: () => {
      throw new Error("user rejected the request");
    },
  });
  await assert.rejects(() => switchToNetwork(w), /user rejected/);
});

test("the switch names a chain id, not a chain name", async () => {
  // A wallet matches on chainId. Sending it a human readable name silently
  // switches nothing and reports success.
  let sent = null;
  const w = wallet({
    wallet_switchEthereumChain: (params) => {
      sent = params;
      return null;
    },
  });
  await switchToNetwork(w);
  assert.ok(Array.isArray(sent), "params must be an array");
  assert.match(String(sent[0].chainId), /^0x[0-9a-f]+$/i, "chainId must be hex");
});

/* -------------------------------------------------------------------------
 * Disconnecting.
 *
 * EIP-1193 has no disconnect, which is why almost every dapp's disconnect is a
 * lie: it clears the address out of the page's own state, and the next reload
 * calls eth_accounts, gets the still-granted account back and reconnects
 * silently. The button looked like it worked and did not.
 *
 * wallet_revokePermissions revokes the grant for real. The return value here is
 * what lets the interface say WHICH of the two happened rather than claiming
 * the stronger one.
 * ------------------------------------------------------------------------- */

test("a wallet that supports revoking really disconnects", async () => {
  const w = wallet({ wallet_revokePermissions: null });
  assert.equal(await revokeAccess(w), true);
  assert.deepEqual(w.calls, ["wallet_revokePermissions"]);
});

test("it asks to revoke eth_accounts specifically", async () => {
  // An empty params object revokes nothing on some wallets and everything on
  // others. Name the permission.
  let sent = null;
  const w = wallet({
    wallet_revokePermissions: (params) => {
      sent = params;
      return null;
    },
  });
  await revokeAccess(w);
  assert.ok(Array.isArray(sent), "params must be an array");
  assert.ok(
    Object.prototype.hasOwnProperty.call(sent[0], "eth_accounts"),
    "must name eth_accounts"
  );
});

test("a wallet that cannot revoke reports false rather than throwing", async () => {
  // Older MetaMask and most other wallets. The caller still clears its own
  // state; what it must NOT do is tell the reader they are disconnected when
  // the grant is still standing and the next reload will reconnect.
  const w = wallet({
    wallet_revokePermissions: () => {
      const e = new Error("The method does not exist");
      e.code = -32601;
      throw e;
    },
  });
  assert.equal(await revokeAccess(w), false);
});

test("a user rejecting the revoke also reports false", async () => {
  const w = wallet({
    wallet_revokePermissions: () => {
      const e = new Error("user rejected");
      e.code = 4001;
      throw e;
    },
  });
  assert.equal(await revokeAccess(w), false);
});
