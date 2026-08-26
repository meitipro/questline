import type { Metadata } from "next";

import { ChronicleFeed } from "@/components/ChronicleFeed";
import { SampleNote } from "@/components/SampleNote";
import { getChronicle } from "@/lib/contract";

export const dynamic = "force-dynamic";

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
