"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 * EVERY STATE HERE LEADS SOMEWHERE, which is the whole point of this component
 * and used to be true of exactly one of them:
 *
 *  - no wallet      was a grey label. Now it links to where you get one.
 *  - WRONG NETWORK  was red text, so the app worked out that every write would
 *                   fail, said so, and left the reader to find the network
 *                   switcher in their extension and type a chain id from
 *                   memory. Now it is a button that switches.
 *  - connected      was a link to your character sheet and nothing else. There
 *                   was no way to disconnect at all - once a wallet was
 *                   attached the interface simply kept addressing it. Now the
 *                   address opens a menu with somewhere to go and a way out.
 *  - a failed connect lived in a `title` tooltip, and tooltips do not exist on
 *                   a touch screen, so on a phone a failure was silent.
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
    disconnect,
    switchChain,
  } = useWallet();

  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const box = useRef<HTMLSpanElement | null>(null);
  const pill = useRef<HTMLButtonElement | null>(null);
  const [at, setAt] = useState<{ top: number; right: number; width: number } | null>(null);

  /**
   * Where the overlay sits, measured from the pill rather than anchored to it.
   *
   * Anchoring with `right: 0` aligns the menu's right edge to the PILL's, and
   * the pill is narrower than the menu - so on a 320px phone a 220px menu
   * started at -48px and lost its left edge off the screen. Anchoring to the
   * viewport with a fixed `top` does not work either, because the header's
   * height changes with what it is carrying.
   *
   * So: measure, clamp, and place. Correct at any width and any header height,
   * and it replaces a media query that could only ever guess.
   */
  const place = useCallback(() => {
    const el = pill.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 12;
    /* Floored against the header's own bottom edge as well as the pill's.
     * Measuring the pill alone put the menu 12px too high - the header is
     * sticky and its height changes as it wraps, so the rect read at the moment
     * the menu opens is not always the rect it settles at. Whatever the cause,
     * clearing the header is the property that actually matters: a menu tucked
     * under the bar it belongs to is unreadable. */
    const bar = el.closest("header")?.getBoundingClientRect();
    const below = Math.max(r.bottom, bar ? bar.bottom : 0) + 12;
    const width = Math.min(260, window.innerWidth - margin * 2);
    // Right offset from the viewport's right edge, never so large that the
    // menu's left edge would go past the margin.
    const right = Math.max(margin, Math.min(window.innerWidth - r.right, window.innerWidth - width - margin));
    /* The width is APPLIED, not just assumed. Clamping against a width the
     * element does not actually have is arithmetic about a different box: the
     * menu sized itself to its content at 272px while the clamp reasoned about
     * 260, and the left edge landed 12px off. */
    setAt({ top: Math.round(below), right: Math.round(right), width: Math.round(width) });
  }, []);

  /* A menu that cannot be dismissed is a trap on a phone, where there is no
   * Escape key and no obvious "click away" affordance until you try it. Both
   * are wired, and the pointer listener is on pointerdown rather than click so
   * it fires before the thing underneath takes the tap. */
  useEffect(() => {
    if (!open) return;
    place();
    /* And again once the menu is actually in the DOM. The first call measures
     * the pill before the browser has laid out the row the menu joins, and on a
     * narrow screen where the header wraps that is a different number. */
    const settle = setTimeout(place, 0);
    /* A fixed overlay does not move with the page, so it has to be told. */
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    const away = (e: Event) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      clearTimeout(settle);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, place]);

  if (!IS_LIVE) return null;

  /* Errors are rendered, not hovered, for both connect and switch. */
  const problem = error ? (
    <span
      className="mono"
      role="status"
      style={{ fontSize: 11, color: "var(--fail-text)", maxWidth: "22ch", lineHeight: 1.35 }}
    >
      {error}
    </span>
  ) : null;

  /* Rendered in BOTH the connected and disconnected branches, because the note
   * it carries is produced by the transition between them. It was only in the
   * connected branch, so disconnecting set a message and then immediately
   * re-rendered into the branch that does not show one - the reader clicked
   * Disconnect and was told nothing at all. Caught by clicking it. */
  const receipt = note ? (
    /* Absolutely positioned so it cannot widen the header. As a flex item its
     * two lines of text pushed the 320px layout 30px sideways - the honest
     * message about a wallet that would not revoke is the longest string this
     * component can produce, and it arrived in the narrowest state. */
    <span
      className="mono wallet-note"
      role="status"
      style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.35 }}
    >
      {note}
    </span>
  ) : null;

  if (!hasWallet) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="mono"
        style={{
          fontSize: 12,
          color: "var(--muted)",
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
        title="Questline needs a browser wallet to sign an action"
      >
        no wallet
      </a>
    );
  }

  if (!address) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <button type="button" className="wallet-pill" onClick={connect} disabled={connecting}>
          {connecting ? "CONNECTING" : "CONNECT"}
        </button>
        {receipt}
        {problem}
      </span>
    );
  }

  async function onDisconnect() {
    const { revoked } = await disconnect();
    setOpen(false);
    /* Said precisely, because the two outcomes are different facts. A revoked
     * grant survives a reload; a cleared local state does not, and this wallet
     * will hand the account straight back on the next visit. Claiming the
     * stronger one would be the same lie every other dapp's disconnect tells. */
    setNote(
      revoked
        ? "disconnected"
        : "forgotten here. your wallet still grants access, so it may reconnect"
    );
    setTimeout(() => setNote(""), 6000);
  }

  return (
    <span ref={box} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8 }}>
      {onCorrectChain === false ? (
        <button
          type="button"
          className="wallet-pill wallet-pill-network"
          onClick={switchChain}
          disabled={switching}
          style={{ color: "var(--fail-text)", borderColor: "var(--fail-text)" }}
          title={`Your wallet is on another network. Switch it to ${NETWORK_LABEL}.`}
        >
          {switching ? "SWITCHING" : "SWITCH NETWORK"}
        </button>
      ) : null}

      <button
        ref={pill}
        type="button"
        className="wallet-pill"
        style={{ color: "var(--cream)" }}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={address}
      >
        {shortAddr(address)}
      </button>

      {open ? (
        <span
          className="wallet-menu"
          role="menu"
          style={
            at
              ? { top: at.top, right: at.right, width: at.width, maxWidth: at.width }
              : { visibility: "hidden" }
          }
        >
          <Link
            href={playerPath(address)}
            role="menuitem"
            className="wallet-menu-item"
            onClick={() => setOpen(false)}
          >
            Your character sheet
          </Link>
          <span className="wallet-menu-address mono" title={address}>
            {address}
          </span>
          <button
            type="button"
            role="menuitem"
            className="wallet-menu-item wallet-menu-danger"
            onClick={onDisconnect}
          >
            Disconnect
          </button>
        </span>
      ) : null}

      {receipt}
      {problem}
    </span>
  );
}
