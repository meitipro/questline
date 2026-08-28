import type { Metadata } from "next";

import { ChronicleFeed } from "@/components/ChronicleFeed";
import { SampleNote } from "@/components/SampleNote";
import { getChronicle } from "@/lib/contract";

export const dynamic = "force-dynamic";

/**
 * Every page here reads the chain, so it is a function rather than a static
 * file and it gets whatever ceiling the platform hands it - ten seconds on a
 * Vercel hobby plan. lib/contract.ts caps each read at five seconds and falls
 * back to the seeded world, so a page cannot legitimately need this much; the
 * headroom is here so a slow-but-working chain degrades to the seeded world
 * rather than to a gateway timeout, which is a page the visitor cannot read at
 * all.
 */
export const maxDuration = 30;

export const metadata: Metadata = {
  title: "Chronicle",
  description:
    "Every action anyone has resolved: narration, effect, roll, player and rules version, with a permalink per line and a roll anyone can recompute.",
};

export default async function ChroniclePage() {
  const chronicle = await getChronicle(0, 24);

  return (
    <div className="page">
      <SampleNote live={chronicle.live} error={chronicle.error} />

      <div
        style={{
          display: "flex",
          alignItems: "end",
          justifyContent: "space-between",
          gap: 32,
          flexWrap: "wrap",
          marginTop: chronicle.live ? 0 : 24,
        }}
      >
        <div>
          <div className="eyebrow">{"// CHRONICLE"}</div>
          <h1 className="display" style={{ marginTop: 14 }}>
            Every action anyone has resolved.
          </h1>
          <p className="note" style={{ marginTop: 14, maxWidth: "60ch" }}>
            Narration, effect, roll, player and rules version. Each line has a
            permalink, and each roll can be recomputed from public data.
          </p>
        </div>
        <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          {chronicle.data.total.toLocaleString("en-US")} lines
        </div>
      </div>

      <div style={{ marginTop: 26 }}>
        <ChronicleFeed initial={chronicle.data} live={chronicle.live} />
      </div>
    </div>
  );
}
