"use client";

/**
 * The last resort, for a failure inside the root layout itself.
 *
 * It has to render its own <html> and <body> because the layout that normally
 * provides them is the thing that broke, and for the same reason it cannot rely
 * on globals.css having loaded. Hence the inline styles - this is the one file
 * in the project where they are not a shortcut.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#0a0b0c",
          color: "#efebe2",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <div style={{ maxWidth: 560 }}>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              letterSpacing: "0.18em",
              color: "#e9a23b",
            }}
          >
            {"// QUESTLINE"}
          </div>
          <h1
            style={{
              margin: "18px 0 0",
              fontSize: 34,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
            }}
          >
            The site failed to start.
          </h1>
          <p style={{ marginTop: 14, lineHeight: 1.55, color: "#b7b2a8" }}>
            Contract storage is unaffected. The world, its rules and every
            chronicle line are on chain and readable without this site.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: 14,
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
                color: "#7a7f86",
              }}
            >
              digest {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "13px 22px",
              background: "#e9a23b",
              color: "#0a0b0c",
              border: "none",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
