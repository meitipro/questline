"use client";

import { useCallback, useEffect, useState } from "react";

import {
  connectWallet,
  currentAccount,
  readableError,
  revokeAccess,
  switchToNetwork,
} from "./actions";
import { CHAIN_ID_HEX, NETWORK_LABEL } from "./chain";

/**
 * Wallet state, shared.
 *
 * This used to live inside PlayConsole, which meant the header could not say who
 * you were and the season page could not sell you a pass. It is a hook rather
 * than a context because there is no tree to thread it through - each consumer
 * asks the wallet directly, and the wallet is the single source of truth.
 *
 * The two listeners matter more than they look. Without `accountsChanged` the
 * app keeps showing the previous address after someone switches accounts in
 * MetaMask, and every write is then signed by an account the interface is not
 * talking about. Without `chainChanged` a reader who switches networks by hand
 * sees a page that still claims to be on Studio.
 */
export interface Wallet {
  address: string | null;
  /** Null until we have asked. False means the wallet is on another network. */
  onCorrectChain: boolean | null;
  connecting: boolean;
  error: string;
  hasWallet: boolean;
  connect: () => Promise<string | null>;
  /**
   * Forget the wallet, and revoke the grant where the wallet supports it.
   *
   * `revoked` on the result says which of the two happened, because they are
   * genuinely different: a revoked grant survives a reload, a cleared local
   * state does not.
   */
  disconnect: () => Promise<{ revoked: boolean }>;
  /**
   * Move the wallet onto the network this app talks to.
   *
   * Exists because "WRONG NETWORK" without it is a dead end. The interface
   * correctly detected that every write would fail, told the reader so, and
   * then left them to find the network switcher in their extension and type a
   * chain id from memory. Naming a problem is not solving it.
   */
  switchChain: () => Promise<boolean>;
  switching: boolean;
}

/**
 * The injected wallet, typed to the part of EIP-1193 this app actually uses.
 *
 * Narrow on purpose. A wallet object typed `any` silently accepts a misspelled
 * method name and fails at runtime in a browser, which is the worst place to
 * find out.
 */
interface InjectedProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

function injected(): InjectedProvider | undefined {
  return (globalThis as unknown as { ethereum?: InjectedProvider }).ethereum;
}

export function useWallet(): Wallet {
  const [address, setAddress] = useState<string | null>(null);
  const [onCorrectChain, setOnCorrectChain] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [hasWallet, setHasWallet] = useState(false);
  const [switching, setSwitching] = useState(false);

  const readChain = useCallback(async () => {
    const eth = injected();
    if (!eth) return;
    try {
      const id = (await eth.request({ method: "eth_chainId" })) as string;
      setOnCorrectChain(id?.toLowerCase() === CHAIN_ID_HEX.toLowerCase());
    } catch {
      setOnCorrectChain(null);
    }
  }, []);

  /* Extensions do not all inject before React mounts.
   *
   * `hasWallet` was read once, in an effect that runs on the first render, and
   * never again - so a wallet that injected a moment later left the header
   * saying "no wallet" until a full reload, with a Connect button that never
   * appeared. Most extensions are in place first, which is exactly why this
   * fails for a minority and looks like it works.
   *
   * Polled briefly rather than waited on: EIP-1193 has no "I have arrived"
   * event that every wallet fires. The interval clears itself the moment one
   * appears, and gives up after a few seconds rather than spinning forever on a
   * browser that genuinely has none. */
  useEffect(() => {
    if (injected()) return;
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (injected()) {
        setHasWallet(true);
        clearInterval(id);
      } else if (tries > 20) {
        clearInterval(id);
      }
    }, 150);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const eth = injected();
    setHasWallet(Boolean(eth));
    if (!eth) return;

    // eth_accounts, not eth_requestAccounts: this must not raise a wallet
    // prompt on page load. Connecting is something a person chooses to do.
    currentAccount().then((who) => {
      if (who) {
        setAddress(who);
        readChain();
      }
    });

    // Narrowed rather than trusted. The payload comes from whatever extension
    // the visitor has installed, and storing a non-string here would put a
    // broken value straight into the `from` of the next transaction.
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0];
      const next = Array.isArray(accounts) ? accounts[0] : undefined;
      setAddress(typeof next === "string" && next ? next : null);
      setError("");
    };
    const onChain = () => readChain();

    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
    /* `hasWallet` is a dependency so that a wallet arriving late gets its
     * account read and its listeners attached. Without it the poll above would
     * flip the flag, the Connect button would appear, and nothing would be
     * listening for the account or chain changes behind it. */
  }, [readChain, hasWallet]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError("");
    try {
      const who = await connectWallet();
      setAddress(who);
      await readChain();
      return who;
    } catch (e) {
      setError(readableError(e));
      return null;
    } finally {
      setConnecting(false);
    }
  }, [readChain]);

  /**
   * Ask the wallet to switch. The 4902 "unrecognized chain" fallback lives in
   * `switchToNetwork` so it can be tested against a fake provider; this only
   * owns the loading flag and the error.
   *
   * `chainChanged` fires on success and the listener above re-reads the chain,
   * so this does not set `onCorrectChain` itself - one source of truth.
   */
  const switchChain = useCallback(async () => {
    const eth = injected();
    if (!eth) return false;
    setSwitching(true);
    setError("");
    try {
      await switchToNetwork(eth);
      await readChain();
      return true;
    } catch (e) {
      setError(readableError(e));
      return false;
    } finally {
      setSwitching(false);
    }
  }, [readChain]);

  /**
   * Drop the wallet.
   *
   * The local state is cleared either way - that is the part this app controls
   * and it is what makes the interface stop addressing an account the reader
   * has finished with. The revoke is the part that survives a reload, and only
   * some wallets offer it.
   */
  const disconnect = useCallback(async () => {
    const eth = injected();
    const revoked = eth ? await revokeAccess(eth) : false;
    setAddress(null);
    setOnCorrectChain(null);
    setError("");
    return { revoked };
  }, []);

  return {
    address,
    onCorrectChain,
    connecting,
    error,
    hasWallet,
    connect,
    disconnect,
    switchChain,
    switching,
  };
}

/** The network this app expects, for anything that needs to name it. */
export const WALLET_NETWORK_LABEL = NETWORK_LABEL;
