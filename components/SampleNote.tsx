import { IS_LIVE, NETWORK_LABEL } from "@/lib/chain";

/**
 * Says out loud when the page is showing the seeded demonstration world.
 *
 * A product whose entire claim is "you can check us" cannot have screens that
 * look like chain state and are not. So this is never dismissible, never
 * subtle, and it names the one variable that turns it off.
 *
 * `error` is the reason the chain could not be read, when there was one - an RPC
 * that is down is a different fact from a contract that was never deployed, and
 * conflating them is how an outage gets mistaken for a design.
 */
export function SampleNote({ live, error }: { live: boolean; error?: string }) {
  if (live) return null;

  return (
    <div
      className="panel"
      style={{
        margin: "0 auto",
        maxWidth: "var(--page)",
        borderLeft: "2px solid var(--accent)",
        padding: "14px 20px",
      }}
    >
      <div className="label eyebrow-accent">DEMONSTRATION WORLD</div>
      <p className="note" style={{ marginTop: 6, color: "var(--body)" }}>
        {IS_LIVE && error ? (
          <>
            The contract is deployed but {NETWORK_LABEL.toLowerCase()} did not
            answer, so everything on this page comes from the seeded world rather
            than from storage. The node said: {error}
          </>
        ) : (
          <>
            No contract address is set, so everything on this page comes from the
            seeded world rather than from storage. Every roll in it still
            verifies - the timestamps were chosen so the arithmetic on each
            chronicle line is real. Set{" "}
            <span className="mono">NEXT_PUBLIC_QUESTLINE_ADDRESS</span> to read
            the live world instead.
          </>
        )}
      </p>
    </div>
  );
}
