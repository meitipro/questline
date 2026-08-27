"use client";

/**
 * The four questions, as an accordion with one open at a time.
 *
 * Built on a real <button> with `aria-expanded` and a labelled region rather
 * than a div with a click handler, so it is reachable by keyboard and
 * announced correctly. The answer stays in the DOM when collapsed - the row it
 * sits in is collapsed to zero, not removed - so the text is findable by the
 * browser's own search and by a crawler.
 *
 * `hidden` is deliberately NOT used for that reason.
 */

import { useId, useState } from "react";
import Link from "next/link";

import { FAQS, FAQ_INTRO } from "@/lib/landing";

export function Faq() {
  const [open, setOpen] = useState(0);
  const base = useId();

  return (
    <section
      id="faq"
      style={{ position: "relative", background: "var(--panel-dim)", borderTop: "1px solid var(--line)" }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "88px clamp(20px, 3.4vw, 64px)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 32,
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: "46ch" }}>
            <div className="eyebrow">{FAQ_INTRO.eyebrow}</div>
            <h2
              style={{
                margin: "16px 0 0",
                fontSize: "clamp(30px, 3.4vw, 44px)",
                fontWeight: 700,
                letterSpacing: "-.035em",
                lineHeight: 1.05,
              }}
            >
              {FAQ_INTRO.title}
            </h2>
          </div>
          <Link
            href="/chronicle"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 18px",
              border: "1px solid var(--line)",
              color: "var(--cream)",
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            {FAQ_INTRO.cta}
          </Link>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 36 }}>
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            const panelId = `${base}-panel-${i}`;
            const buttonId = `${base}-button-${i}`;
            return (
              <div key={item.question} style={{ border: "1px solid var(--line)", background: "var(--panel)" }}>
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 20,
                    width: "100%",
                    padding: "22px 24px",
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                    cursor: "pointer",
                    color: "inherit",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "0 0 auto",
                      width: 38,
                      height: 38,
                      border: "1px solid var(--line)",
                      borderRadius: "50%",
                      color: "var(--accent-text)",
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      style={{
                        transition: "transform .4s cubic-bezier(.22,1,.36,1)",
                        transform: isOpen ? "rotate(135deg)" : "none",
                      }}
                    >
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0, flex: "1 1 auto" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-.02em", color: "var(--cream)" }}>
                        {item.question}
                      </span>
                      <span
                        className="mono"
                        style={{
                          marginLeft: "auto",
                          padding: "4px 10px",
                          border: "1px solid var(--line)",
                          fontSize: 10,
                          letterSpacing: ".24em",
                          textTransform: "uppercase",
                          color: "var(--muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.meta}
                      </span>
                    </span>
                    {/* Animated with grid-template-rows 0fr -> 1fr rather than
                        a max-height. A max-height needs a number bigger than
                        the tallest answer, and the tallest answer here already
                        reached 216px of a 240px cap at 320px wide - one extra
                        sentence in lib/landing.ts and it would have clipped
                        silently. This has no ceiling to outgrow.

                        The inner element needs min-height:0, for the same
                        reason a grid item needs min-width:0: its automatic
                        minimum is its content, which would refuse to collapse
                        to zero. */}
                    <span
                      style={{
                        display: "grid",
                        gridTemplateRows: isOpen ? "1fr" : "0fr",
                        transition: "grid-template-rows .5s ease",
                      }}
                    >
                      <span
                        id={panelId}
                        role="region"
                        aria-labelledby={buttonId}
                        style={{
                          display: "block",
                          overflow: "hidden",
                          minHeight: 0,
                          fontSize: 15,
                          lineHeight: 1.6,
                          color: "var(--body)",
                        }}
                      >
                        {item.answer}
                      </span>
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
