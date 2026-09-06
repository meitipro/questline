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
 * EVERY STATE HERE LEADS SOMEWHERE. That is the whole point of this component
 * and it used to be true of only one of them:
 *
 *  - no wallet      was a grey label. Now it links to where you get one.
 *  - WRONG NETWORK  was red text. The interface had correctly worked out that
 *                   every write would fail, said so, and then left the reader
 *                   to find the network switcher in their extension and type a
 *                   chain id from memory. Now it is a button that switches, and
 *                   adds the network first if the wallet has never heard of it,
 *                   which for Studio is almost always.
 *  - a failed connect lived in a `title` tooltip. Tooltips do not exist on a
 *                   touch screen, so on a phone the button simply went back to
 *                   saying CONNECT and the reader was told nothing at all.
 *
 * Naming a problem is not solving it, and a refusal has to leave the refused
 * party somewhere to go.
 *
 * Renders nothing when no contract is configured. There is nothing to connect
 * to, and a connect button that leads nowhere is worse than no button.
 */
export function WalletButton() {
  const {
    address,
    onCorrectChain,
    connecting,
    switching,
    error,
    hasWallet,
    connect,
    switchChain,
  } = useWallet();

  if (!IS_LIVE) return null;

  /* Shown under whichever control is on screen, for both connect and switch.
   * Errors are rendered, not hovered. */
  const problem = error ? (
    <span
      className="mono"
      role="status"
      style={{
        fontSize: 11,
        color: "var(--fail-text)",
        maxWidth: "22ch",
        lineHeight: 1.35,
      }}
    >
      {error}
    </span>
  ) : null;

  if (!hasWallet) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="mono"
        style={{ fontSize: 12, color: "var(--muted)", textDecoration: "underline", textUnderlineOffset: 3 }}
        title="Questline needs a browser wallet to sign an action"
      >
        no wallet
      </a>
    );
  }

  if (!address) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          className="wallet-pill"
          onClick={connect}
          disabled={connecting}
        >
          {connecting ? "CONNECTING" : "CONNECT"}
        </button>
        {problem}
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {onCorrectChain === false ? (
        <button
          type="button"
          className="wallet-pill"
          onClick={switchChain}
          disabled={switching}
          style={{ color: "var(--fail-text)", borderColor: "var(--fail-text)" }}
          title={`Your wallet is on another network. Switch it to ${NETWORK_LABEL}.`}
        >
          {/* Short, because this sits in a header beside a nav and a CTA. What
              it means is in the title and, at length, on the pages that are
              about to ask for a signature. */}
          {switching ? "SWITCHING" : "SWITCH NETWORK"}
        </button>
      ) : null}
      <Link
        href={playerPath(address)}
        className="wallet-pill"
        style={{ color: "var(--cream)" }}
        title={address}
      >
        {shortAddr(address)}
      </Link>
      {problem}
    </span>
  );
}
