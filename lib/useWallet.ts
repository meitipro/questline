"use client";

import { useCallback, useEffect, useState } from "react";

import { connectWallet, currentAccount, readableError } from "./actions";
import { CHAIN_ID_HEX } from "./chain";

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
  }, [readChain]);

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

  return { address, onCorrectChain, connecting, error, hasWallet, connect };
}
