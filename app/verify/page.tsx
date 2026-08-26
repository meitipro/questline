import type { Metadata } from "next";
import Link from "next/link";

import { SampleNote } from "@/components/SampleNote";
import { Verifier } from "@/components/Verifier";
import { getChronicle, getWorld } from "@/lib/contract";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify a roll",
  description:
    "Recompute any roll in the chronicle from its three public fields, in your own browser, with no help from this site.",
};

export default async function VerifyPage() {
  const [chronicle, world] = await Promise.all([getChronicle(0, 50), getWorld()]);

  return (
    <div className="page">
      <SampleNote live={chronicle.live} error={chronicle.error} />

      <div style={{ marginTop: chronicle.live ? 0 : 24 }}>
        <div className="eyebrow">{"// VERIFY"}</div>
        <h1 className="display" style={{ marginTop: 14, maxWidth: "24ch" }}>
          Do not take our word for the dice.
        </h1>
        <p className="lede" style={{ marginTop: 16, maxWidth: "64ch" }}>
          Every roll in Questline is a hash of three things anyone can read: when
          the action resolved, who took it, and which line of the chronicle it
          became. The arithmetic below runs in your browser.
        </p>
      </div>

      <div
        className="panel-ink pad"
        style={{ marginTop: 26, borderLeft: "2px solid var(--accent)" }}
      >
        <div className="mono" style={{ fontSize: 14, color: "var(--body)", overflowX: "auto" }}>
          <span style={{ whiteSpace: "nowrap" }}>{world.data.rules.seed}</span>
        </div>
        <p className="note" style={{ marginTop: 12, maxWidth: "70ch" }}>
          That recipe is not a description of what the contract does - it is read
          out of the contract, by{" "}
          <span className="mono">get_world</span>. The contract will also
          recompute a roll for you itself, through{" "}
          <span className="mono">verify_roll</span>, so there are three
          independent ways to reach the same number: storage, this page, and the
          chain.
        </p>
      </div>

      <div style={{ marginTop: 26 }}>
        <Verifier initialLines={chronicle.data.lines} live={chronicle.live} />
      </div>

      <div className="panel pad" style={{ marginTop: 26 }}>
        <div className="label">WHAT A DISAGREEMENT WOULD MEAN</div>
        <p className="lede" style={{ marginTop: 12, maxWidth: "72ch", color: "var(--cream)" }}>
          It would mean the roll shown on a chronicle line is not the roll the
          contract computed, and that the world is not what it says it is.
        </p>
        <p className="note" style={{ marginTop: 12, maxWidth: "72ch" }}>
          Nothing here is designed to reassure you. This page recomputes the
          numbers and reports what it finds; if it ever finds a mismatch it says
          so in red and tells you not to trust the line. That is the difference
          between a claim and a check.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <Link href="/chronicle" className="btn-ghost">
            Read the chronicle
          </Link>
          <Link href="/world" className="btn-ghost">
            Read the rules
          </Link>
        </div>
      </div>
    </div>
  );
}
