"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * The route-level failure page.
 *
 * It says which layer broke, because in this product that distinction is the
 * whole question a reader has: a page that cannot render is a bug in the site,
 * and the world on chain is untouched either way. Nothing here implies anything
 * about the chronicle, because nothing here knows anything about it.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Vercel captures this into the function logs, where the digest below is
    // the thing that ties a reader's screenshot to a specific stack trace.
    console.error("questline route error", error);
  }, [error]);

  return (
    <div className="page">
      <div className="eyebrow">{"// THIS PAGE FAILED"}</div>
      <h1 className="display" style={{ marginTop: 14, maxWidth: "24ch" }}>
        The site broke. The world did not.
      </h1>
      <p className="lede" style={{ marginTop: 16, maxWidth: "58ch" }}>
        This is a rendering failure in the interface. Contract storage is
        untouched by it - every chronicle line, roll and item is exactly where it
        was, and can be read back by anyone with the contract address.
      </p>

      {error.digest ? (
        <p className="mono" style={{ marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
          digest {error.digest}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
        <button className="btn" onClick={reset}>
          Try again
        </button>
        <Link href="/chronicle" className="btn-ghost">
          Read the chronicle
        </Link>
      </div>
    </div>
  );
}
