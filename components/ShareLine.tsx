"use client";

import { useRef, useState } from "react";

/**
 * Copies the permalink.
 *
 * The label reports what actually happened rather than assuming: a clipboard
 * write is refused often enough - an insecure origin, an unfocused window, a
 * denied permission - that a button claiming success it did not have would be
 * lying about the one thing this page exists for.
 *
 * And when it is refused, the url is revealed and selected rather than the
 * reader being told to go and find it. A share button whose failure mode is
 * "do it yourself, elsewhere" is a share button that does not work.
 */
export function ShareLine({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const fallbackRef = useRef<HTMLInputElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2600);
      return;
    } catch {
      /* fall through to the manual path */
    }

    setState("failed");
    // Reveal it, then select it, so the next keystroke a person makes is the
    // one they were already reaching for.
    requestAnimationFrame(() => {
      const input = fallbackRef.current;
      if (!input) return;
      input.focus();
      input.select();
      try {
        // Deprecated, and still the only thing that works in some embedded
        // browsers. If it succeeds the reader never sees the manual step.
        if (document.execCommand("copy")) {
          setState("copied");
          setTimeout(() => setState("idle"), 2600);
        }
      } catch {
        /* leave it selected; the reader can copy it by hand */
      }
    });
  }

  return (
    <>
      <button className="btn" onClick={copy} aria-live="polite">
        {state === "copied" ? "Link copied" : "Share this line"}
      </button>

      {state === "failed" ? (
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            width: "100%",
            marginTop: 4,
          }}
        >
          <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
            This browser refused the clipboard. The link is selected - copy it.
          </span>
          <input
            ref={fallbackRef}
            className="field mono"
            style={{ fontSize: 14 }}
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
      ) : null}
    </>
  );
}
