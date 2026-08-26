import Link from "next/link";

import { Countdown } from "@/components/Countdown";
import { LiveFeed } from "@/components/LiveFeed";
import { SampleNote } from "@/components/SampleNote";
import { getChronicle, getWorld } from "@/lib/contract";
import { ago, countdown, gen } from "@/lib/format";

export const dynamic = "force-dynamic";

const COMPARISON = [
  {
    step: "Interpret an action",
    today: "A server calls a model, and you trust the server.",
    here: "Validators resolve it against public criteria and must agree on the outcome.",
  },
  {
    step: "Roll the dice",
    today: "The house rolls in private.",
    here: "Seeded from transaction data, computed in the deterministic half, reproducible by anyone.",
  },
  {
    step: "Own an item",
    today: "A row in the operator's database.",
    here: "An entry in contract storage that the operator cannot edit.",
  },
  {
    step: "Change the rules",
    today: "A patch note, applied retroactively.",
    here: "A new region rules version, with old chronicle lines pinned to the version they ran under.",
  },
];

const WITHOUT = [
  "The operator can mint anything for anyone",
  "Rolls happen where nobody can see them",
  "Rules change between sessions",
  "Nothing you earn is really yours",
];

const WITH = [
  "The game master is a rule set several strangers apply",
  "Every roll is reproducible from public data",
  "Rule versions are pinned to the actions they governed",
  "Items exist independently of the studio",
];

const PIPELINE = [
  { n: "01", name: "Activation", body: "Transaction enters, leader and validators drawn." },
  { n: "02", name: "Proposal", body: "Leader runs the block and proposes a result." },
  { n: "03", name: "Commit", body: "Validators vote in sealed form." },
  { n: "04", name: "Reveal", body: "Votes opened and counted." },
  { n: "05", name: "Finality", body: "Window passes, external messages fire." },
];

export default async function HomePage() {
  const [world, chronicle] = await Promise.all([getWorld(), getChronicle(0, 8)]);
  const now = new Date();

  const rows = chronicle.data.lines.map((line) => ({
    line,
    ago: ago(line.at, now),
  }));

  return (
    <div>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.15fr .85fr",
          gap: 56,
          alignItems: "start",
          padding: "88px 32px 64px",
          maxWidth: "var(--page)",
          margin: "0 auto",
        }}
        className="hero"
      >
        <div>
          <div className="eyebrow eyebrow-accent">{"// the game master is a contract"}</div>
          <h1
            style={{
              margin: "22px 0 0",
              fontSize: "clamp(42px, 5.4vw, 74px)",
              lineHeight: 0.96,
              letterSpacing: "-.045em",
              fontWeight: 700,
              textWrap: "balance",
            }}
          >
            Nobody here
            <br />
            <span style={{ color: "var(--muted)" }}>can cheat. Not even us.</span>
          </h1>
          <p className="lede" style={{ margin: "26px 0 0", maxWidth: "52ch" }}>
            The rules, the rolls and your inventory live on chain. Validators
            resolve what you type against rules you can read.
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 34, flexWrap: "wrap" }}>
            <Link href="/play" className="btn">
              Enter the world
            </Link>
            <Link href="/chronicle" className="btn-ghost">
              Read the chronicle
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 24,
              marginTop: 64,
              borderTop: "1px solid var(--line)",
              paddingTop: 24,
            }}
          >
            <div>
              <div className="stat-value">
                {world.data.counts.players.toLocaleString("en-US")}
              </div>
              <div className="stat-key">PLAYERS</div>
            </div>
            <div>
              <div className="stat-value">
                {world.data.counts.actions.toLocaleString("en-US")}
              </div>
              <div className="stat-key">ACTIONS RESOLVED</div>
            </div>
            <div>
              <div className="stat-value" style={{ color: "var(--accent-text)" }}>
                {gen(world.data.season.pool)}
              </div>
              <div className="stat-key">SEASON POOL</div>
            </div>
          </div>
        </div>

        {/* The homepage is the chronicle. Real resolved actions with real rolls
            are more convincing than any amount of concept art. */}
        <LiveFeed initial={rows} live={chronicle.live} />
      </section>

      <div style={{ padding: "0 32px 24px" }}>
        <SampleNote live={chronicle.live} error={chronicle.error} />
      </div>

      <section className="band band-dim">
        <div style={{ maxWidth: "var(--page)", margin: "0 auto", padding: "72px 32px" }}>
          <div className="eyebrow">{"// THE PROBLEM"}</div>
          <h2 className="display" style={{ margin: "16px 0 0", maxWidth: "22ch" }}>
            Text worlds run by AI are everywhere. None of them are fair.
          </h2>
          <p className="lede" style={{ margin: "20px 0 0", maxWidth: "62ch" }}>
            The operator can rewrite the world, mint the rare item, and roll back
            the loss. On chain games solved fairness by removing everything
            interesting, so the result is a spreadsheet with art.
          </p>

          <div style={{ marginTop: 48, border: "1px solid var(--line)" }}>
            <div
              className="grid-1px label"
              style={{ gridTemplateColumns: "1fr 1fr 1fr", border: "none" }}
            >
              <div style={{ background: "var(--panel)", padding: "12px 18px" }}>STEP</div>
              <div style={{ background: "var(--panel)", padding: "12px 18px" }}>
                HOW IT WORKS TODAY
              </div>
              <div
                style={{ background: "var(--panel)", padding: "12px 18px", color: "var(--accent-text)" }}
              >
                HOW IT WORKS HERE
              </div>
            </div>
            {COMPARISON.map((row) => (
              <div
                key={row.step}
                className="grid-1px compare"
                style={{ gridTemplateColumns: "1fr 1fr 1fr", border: "none" }}
              >
                <div style={{ background: "var(--ink)", padding: 18, fontWeight: 600 }}>
                  {row.step}
                </div>
                <div style={{ background: "var(--ink)", padding: 18, color: "var(--muted)" }}>
                  {row.today}
                </div>
                <div style={{ background: "var(--ink)", padding: 18, color: "var(--body)" }}>
                  {row.here}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band">
        <div style={{ maxWidth: "var(--page)", margin: "0 auto", padding: "72px 32px" }}>
          <div className="eyebrow">{"// WHY GENLAYER"}</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
              marginTop: 26,
            }}
            className="two-up"
          >
            <div className="panel-dim pad">
              <div className="label">WITHOUT GENLAYER</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
                {WITHOUT.map((item) => (
                  <div key={item} style={{ display: "flex", gap: 12, color: "var(--muted)" }}>
                    <span aria-hidden style={{ color: "var(--dim)" }}>&times;</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel pad">
              <div className="label eyebrow-accent">WITH GENLAYER</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
                {WITH.map((item) => (
                  <div key={item} style={{ display: "flex", gap: 12 }}>
                    <span style={{ color: "var(--accent-text)" }}>&rarr;</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 56 }}>
            <div className="eyebrow">{"// HOW THE NETWORK DECIDES"}</div>
            <div
              className="grid-1px pipeline"
              style={{ gridTemplateColumns: "repeat(5, 1fr)", marginTop: 22 }}
            >
              {PIPELINE.map((stage) => (
                <div key={stage.n} style={{ background: "var(--ink)", padding: "22px 18px" }}>
                  <div className="mono" style={{ fontSize: 12, color: "var(--accent-text)" }}>
                    {stage.n}
                  </div>
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 18,
                      fontWeight: 600,
                      letterSpacing: "-.02em",
                    }}
                  >
                    {stage.name}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>
                    {stage.body}
                  </div>
                </div>
              ))}
            </div>
            <p className="note" style={{ margin: "22px 0 0", maxWidth: "70ch" }}>
              The magnitude the model returns is capped by the region before it is
              applied. The model narrates, the code decides, and that division is
              what makes the world safe to leave running.
            </p>
          </div>
        </div>
      </section>

      <section className="band band-panel">
        <div
          style={{
            maxWidth: "var(--page)",
            margin: "0 auto",
            padding: "72px 32px",
            display: "flex",
            alignItems: "end",
            justifyContent: "space-between",
            gap: 40,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 className="display" style={{ maxWidth: "18ch" }}>
              The archive is quiet. Someone has to go first.
            </h2>
            <p className="note" style={{ margin: "18px 0 0", maxWidth: "56ch" }}>
              Season {world.data.season.number} closes in{" "}
              <span className="mono">
                <Countdown
                  ends={world.data.season.ends}
                  initial={countdown(world.data.season.ends, now)}
                />
              </span>
 . Entry is a season pass; every line you write stays public whether
              it works or not.
            </p>
          </div>
          <Link href="/play" className="btn" style={{ padding: "15px 26px", fontSize: 18 }}>
            Enter the world
          </Link>
        </div>
      </section>
    </div>
  );
}
