import type { Metadata } from "next";

import { SampleNote } from "@/components/SampleNote";
import { getWorld } from "@/lib/contract";
import { gen } from "@/lib/format";

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
  title: "World and rules",
  description:
    "Every region, its rules and version, the item registry, and the exact criteria validators apply when they resolve an action.",
};

export default async function WorldPage() {
  const world = await getWorld();
  const { regions, registry, rules, adjudication, season } = world.data;

  return (
    <div className="page">
      <SampleNote live={world.live} error={world.error} />

      <div style={{ marginTop: world.live ? 0 : 24 }}>
        <div className="eyebrow">{"// THE WORLD"}</div>
        <h1 className="display" style={{ marginTop: 14, maxWidth: "20ch" }}>
          The rules are the product. Read them before you play.
        </h1>
      </div>

      {/* ---- regions ---- */}
      <div
        className="grid-1px regions"
        style={{ gridTemplateColumns: "repeat(2, 1fr)", marginTop: 36 }}
      >
        {regions.map((region) => (
          <div key={region.index} style={{ background: "var(--panel)", padding: 26 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.025em" }}>
                {region.name}
              </div>
              <div className="mono" style={{ fontSize: 12, color: "var(--accent-text)" }}>
                rules v{region.rules_version}
              </div>
            </div>

            <p style={{ margin: "12px 0 0", color: "var(--body)" }}>{region.description}</p>

            <div
              className="mono"
              style={{
                marginTop: 16,
                borderTop: "1px solid var(--line)",
                paddingTop: 14,
                fontSize: 12,
                color: "var(--muted)",
                lineHeight: 1.7,
              }}
            >
              <div>max magnitude . {region.max_magnitude}</div>
              <div>partial band ceiling . {Math.ceil(region.max_magnitude / 2)}</div>
              <div>depth . {region.depth}</div>
              <div>exits . {region.exits.join(", ") || "none"}</div>
            </div>

            {/* The full rules text, not a summary of it. A player about to lose a
                turn to a rule is owed the sentence that took it. */}
            <p
              className="mono"
              style={{
                marginTop: 14,
                fontSize: 12,
                lineHeight: 1.7,
                color: "var(--body)",
              }}
            >
              {region.rules}
            </p>
          </div>
        ))}
      </div>

      {/* ---- registry and criteria ---- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginTop: 36,
          alignItems: "start",
        }}
        className="two-up"
      >
        <div className="panel pad">
          <div className="label">ITEM REGISTRY</div>
          <p className="note" style={{ marginTop: 12 }}>
            Nothing outside this map can exist. If the model hands you something
            that is not here, the effect degrades to none.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
            {registry.map((item) => (
              <span key={item.name} className="tag" title={item.note}>
                {item.name}
              </span>
            ))}
          </div>
          {registry.length === 0 ? (
            <p className="note" style={{ marginTop: 14, color: "var(--fail-text)" }}>
              The registry is empty, so no action can grant anything at all.
            </p>
          ) : null}
        </div>

        <div className="panel-ink pad">
          <div className="label eyebrow-accent">THE CRITERIA VALIDATORS APPLY</div>
          {/* Read from the contract, not restated here, so this list cannot drift
              from the string that actually adjudicates an action. */}
          <div
            className="mono"
            style={{ marginTop: 16, fontSize: 14, lineHeight: 1.8, color: "var(--body)" }}
          >
            {adjudication.criteria.map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                <span aria-hidden style={{ color: "var(--dim)" }}>-</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- the dice, the clock, the seed ---- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginTop: 24,
          alignItems: "start",
        }}
        className="two-up"
      >
        <div className="panel pad">
          <div className="label">THE DICE AND THE CLOCK</div>
          <div style={{ marginTop: 16 }}>
            <div className="kv">
              <span className="k">the die</span>
              <span>{rules.die} faces</span>
            </div>
            <div className="kv">
              <span className="k">bands</span>
              <span>
                1 to {rules.fail_max} fails, {rules.fail_max + 1} to{" "}
                {rules.partial_max} partial, {rules.partial_max + 1} to {rules.die}{" "}
                succeeds
              </span>
            </div>
            <div className="kv">
              <span className="k">on a failed roll</span>
              <span>{rules.fail_effects.join(", ")} only</span>
            </div>
            <div className="kv">
              <span className="k">energy</span>
              <span>
                {rules.max_energy} per {rules.cycle_hours} hour cycle, spent only
                when an action resolves
              </span>
            </div>
            <div className="kv">
              <span className="k">health</span>
              <span>{rules.max_health} at full</span>
            </div>
            <div className="kv">
              <span className="k">season pass</span>
              <span>{gen(season.pass_price, 2)} GEN</span>
            </div>
            <div className="kv">
              <span className="k">item mint</span>
              <span>{gen(season.mint_price, 2)} GEN</span>
            </div>
          </div>
        </div>

        <div className="panel pad">
          <div className="label">HOW A ROLL IS MADE</div>
          <p className="note" style={{ marginTop: 12 }}>
            The dice are not rolled anywhere private. Every roll is a hash of three
            public fields, so any player can recompute any roll in the chronicle.
          </p>
          <div
            className="mono"
            style={{
              marginTop: 16,
              border: "1px solid var(--line)",
              background: "var(--ink)",
              padding: 16,
              fontSize: 14,
              color: "var(--body)",
              overflowX: "auto",
            }}
          >
            {rules.seed}
          </div>
          <p className="note" style={{ marginTop: 14 }}>
            Every chronicle line shows its own seed string and the arithmetic. The
            contract will also recompute one for you through{" "}
            <span className="mono">verify_roll</span>, and the browser does the
            same sum on the page, so the two can be compared. There is a page
            for doing exactly that: <a href="/verify">verify a roll</a>.
          </p>
        </div>
      </div>

      {/* ---- how a turn settles ---- */}
      <div className="panel pad" style={{ marginTop: 36 }}>
        {/* This panel was headed WHAT THIS PRODUCT CANNOT DO and listed three
            absences. The facts were right and the framing was backwards: each
            one is a mechanism doing its job, and a page arguing that the rules
            are the product should name the rule rather than apologise for its
            shape. */}
        <div className="label">HOW A TURN SETTLES</div>
        <p className="lede" style={{ marginTop: 12, maxWidth: "72ch", color: "var(--cream)" }}>
          A turn takes as long as several strangers need to agree on what
          happened. That is the cost of the guarantee, and it is why actions are
          deliberate and scarce rather than continuous.
        </p>
        <p className="note" style={{ marginTop: 14, maxWidth: "72ch" }}>
          Two more things the shape decides. The narration is written by a
          model, so its prose varies between turns even where the rules do not:
          the effect, the target and the magnitude are what the criteria hold.
          And an appeal costs the protocol bond, which is deliberately larger than
          any single action is worth, so appealing is a season ending move rather
          than a turn by turn one.
        </p>
      </div>
    </div>
  );
}
