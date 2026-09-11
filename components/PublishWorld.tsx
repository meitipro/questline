"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { humaniseStamps, publishItems, publishRegion, readableError } from "@/lib/actions";
import { NETWORK_LABEL } from "@/lib/chain";
import { shortAddr } from "@/lib/format";
import { OPENING_REGIONS, OPENING_REGISTRY } from "@/lib/opening-world";
import { useWallet } from "@/lib/useWallet";

/**
 * Publish the opening world from a browser wallet.
 *
 * Five transactions, in order: the item registry, then the four regions. Each
 * row says what it is waiting on, and a refusal stops the run and shows the
 * contract's own sentence rather than a guess at it.
 *
 * The plan is worked out from what the chain already holds, so pressing the
 * button twice - or after a dropped connection - sends only what is missing.
 *
 * A wallet that is not the owner is not blocked here. It is told plainly that
 * it is not the owner, and offered the chance to send anyway, because watching
 * the contract refuse a stranger is the authorisation check demonstrated
 * rather than described.
 */

type StepState = "waiting" | "already" | "signing" | "sent" | "done" | "refused";

interface Step {
  key: string;
  label: string;
  state: StepState;
  note?: string;
}

const ITEM_COUNT = OPENING_REGISTRY.split(";").filter((p) => p.trim()).length;

function planFor(items: number, regions: string[]): Step[] {
  const have = new Set(regions.map((r) => r.trim().toLowerCase()));
  return [
    {
      key: "items",
      label: `Item registry . ${ITEM_COUNT} items`,
      state: items >= ITEM_COUNT ? "already" : "waiting",
    },
    ...OPENING_REGIONS.map((r) => ({
      key: r.name,
      label: `Region . ${r.name}`,
      state: (have.has(r.name.toLowerCase()) ? "already" : "waiting") as StepState,
    })),
  ];
}

const STATE_TEXT: Record<StepState, string> = {
  waiting: "waiting",
  already: "already on chain",
  signing: "sign it in your wallet",
  sent: "the network is running it",
  done: "published",
  refused: "refused",
};

const STATE_COLOR: Record<StepState, string> = {
  waiting: "var(--muted)",
  already: "var(--muted)",
  signing: "var(--accent-text)",
  sent: "var(--accent-text)",
  done: "var(--success-text)",
  refused: "var(--fail-text)",
};

export function PublishWorld({
  owner,
  items,
  regions,
}: {
  owner: string;
  items: number;
  regions: string[];
}) {
  const wallet = useWallet();
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>(() => planFor(items, regions));
  const [running, setRunning] = useState(false);

  const isOwner =
    !!wallet.address && !!owner && wallet.address.toLowerCase() === owner.toLowerCase();
  const remaining = steps.filter((s) => s.state === "waiting" || s.state === "refused").length;
  const allDone = steps.every((s) => s.state === "done" || s.state === "already");

  async function run() {
    if (!wallet.address || running) return;
    setRunning(true);
    const from = wallet.address as `0x${string}`;
    let current = steps.map((s) => ({ ...s }));

    for (let i = 0; i < current.length; i++) {
      if (current[i].state !== "waiting" && current[i].state !== "refused") continue;
      const update = (patch: Partial<Step>) => {
        current = current.map((s, j) => (j === i ? { ...s, ...patch } : s));
        setSteps(current);
      };
      update({ state: "signing", note: undefined });
      const onStage = (stage: string, note?: string) => {
        if (stage === "sent") update({ state: "sent", note });
      };
      try {
        const key = current[i].key;
        if (key === "items") {
          await publishItems(from, OPENING_REGISTRY, onStage);
        } else {
          const region = OPENING_REGIONS.find((r) => r.name === key);
          if (!region) throw new Error(`no opening region named ${key}`);
          await publishRegion(from, region, onStage);
        }
        update({ state: "done", note: undefined });
      } catch (e) {
        /* Stop at the first refusal. Carrying on would send four more
         * transactions that fail for the same reason - and a region sent after
         * a failed registry is a region nobody can earn anything in. */
        update({ state: "refused", note: humaniseStamps(readableError(e)) });
        setRunning(false);
        return;
      }
    }

    setRunning(false);
    router.refresh();
  }

  return (
    <div className="panel pad" style={{ marginTop: 28 }}>
      <div className="kv">
        <span className="k">owner</span>
        <span className="mono" style={{ overflowWrap: "anywhere" }}>
          {owner || "unknown"}
        </span>
      </div>
      <div className="kv">
        <span className="k">your wallet</span>
        <span
          className="mono"
          style={{
            overflowWrap: "anywhere",
            color: !wallet.address
              ? "var(--muted)"
              : isOwner
                ? "var(--success-text)"
                : "var(--fail-text)",
          }}
        >
          {wallet.address ?? "not connected"}
        </span>
      </div>

      <div style={{ marginTop: 22, borderTop: "1px solid var(--line)" }}>
        {steps.map((s) => (
          <div key={s.key} className="kv" style={{ alignItems: "flex-start" }}>
            <span className="k" style={{ textTransform: "none" }}>
              {s.label}
            </span>
            <span style={{ color: STATE_COLOR[s.state], textAlign: "right" }}>
              {s.note ?? STATE_TEXT[s.state]}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        {allDone ? (
          <>
            <p className="note" style={{ color: "var(--success-text)" }}>
              The opening world is on chain. Every player now enters at the sunken
              archive, and every item they can earn is in the registry.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/world" className="btn">
                See the world
              </Link>
              <Link href="/play" className="btn-ghost">
                Enter it
              </Link>
            </div>
          </>
        ) : !wallet.hasWallet ? (
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{ textAlign: "center" }}
          >
            Publishing needs a browser wallet
          </a>
        ) : !wallet.address ? (
          <button className="btn" onClick={wallet.connect} disabled={wallet.connecting}>
            {wallet.connecting ? "connecting..." : "Connect the owner's wallet"}
          </button>
        ) : wallet.onCorrectChain === false ? (
          <button
            className="btn-ghost"
            style={{ color: "var(--fail-text)" }}
            onClick={wallet.switchChain}
            disabled={wallet.switching}
          >
            {wallet.switching
              ? "switching..."
              : `Your wallet is on another network . switch to ${NETWORK_LABEL}`}
          </button>
        ) : isOwner ? (
          <button className="btn" onClick={run} disabled={running}>
            {running
              ? "publishing..."
              : `Publish the opening world . ${remaining} transaction${remaining === 1 ? "" : "s"}`}
          </button>
        ) : (
          <>
            <p className="note" style={{ color: "var(--fail-text)" }}>
              This wallet is not the owner. Only {shortAddr(owner)} can publish the
              world - switch to that account in your wallet. If it was created
              inside Studio, import its key into your wallet first.
            </p>
            <button className="btn-ghost" onClick={run} disabled={running}>
              {running ? "sending..." : "Send it anyway, and watch the contract refuse"}
            </button>
          </>
        )}

        {wallet.error ? <div className="blocked">{wallet.error}</div> : null}
      </div>
    </div>
  );
}
