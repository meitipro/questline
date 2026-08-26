"use client";

import Link from "next/link";

import { IS_LIVE, NETWORK_LABEL } from "@/lib/chain";
import { playerPath, shortAddr } from "@/lib/format";
import { useWallet } from "@/lib/useWallet";

/**
 * Connect, and then say who you are and whether the wallet is on the right
 * network.
 *
 * The network line is not decoration. Every write is signed against a specific
 * chain, and a wallet quietly sitting on Ethereum mainnet is the single most
 * common reason a transaction fails for a reason the error message does not
 * explain. Saying so up front costs one line.
 *
 * Renders nothing at all when no contract is configured. There is nothing to
 * connect to, and a connect button that leads nowhere is worse than no button.
 */
export function WalletButton() {
  const { address, onCorrectChain, connecting, error, hasWallet, connect } =
    useWallet();

  if (!IS_LIVE) return null;

  if (!hasWallet) {
    return (
      <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
        no wallet
      </span>
    );
  }

  if (!address) {
    return (
      <button
        type="button"
        className="theme-toggle"
        onClick={connect}
        disabled={connecting}
        title={error || "Connect a wallet to act"}
      >
        {connecting ? "CONNECTING" : "CONNECT"}
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {onCorrectChain === false ? (
        <span
          className="mono"
          style={{ fontSize: 12, color: "var(--fail-text)" }}
          title={`Switch your wallet to ${NETWORK_LABEL}`}
        >
          WRONG NETWORK
        </span>
      ) : null}
      <Link
        href={playerPath(address)}
        className="theme-toggle"
        style={{ color: "var(--cream)" }}
        title={address}
      >
        {shortAddr(address)}
      </Link>
    </span>
  );
}
