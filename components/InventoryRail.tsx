import Link from "next/link";

import { linePath } from "@/lib/format";
import type { Player } from "@/lib/types";

/**
 * Items with the chronicle line that granted them, so provenance is one click
 * away.
 *
 * That link is the point of the panel. An item here is not a row in a database
 * somebody could edit; it is the consequence of a resolved action whose roll and
 * rules version are public, and the shortest way to say so is to let a player
 * click through to the moment it happened.
 */
export function InventoryRail({
  player,
  title = "INVENTORY",
  onMint,
  minting,
  mintPrice,
  mintNote,
}: {
  player: Player;
  title?: string;
  /**
   * Minting turns an earned item into a tradable one. Optional because this
   * panel is also the read-only inventory on someone else's character sheet,
   * and offering to mint another person's belongings would be nonsense.
   */
  onMint?: (item: string) => void;
  minting?: string | null;
  mintPrice?: string;
  mintNote?: string;
}) {
  return (
    <div className="panel pad-sm">
      <div className="label">{title}</div>

      {player.inventory.length === 0 ? (
        <p className="note" style={{ marginTop: 12 }}>
          You are carrying nothing. Everything in the world has to be earned by a
          line in the chronicle.
        </p>
      ) : (
        <div className="rowlist" style={{ marginTop: 12 }}>
          {player.inventory.map((item) => {
            const from = player.provenance?.[item];
            return (
              <span key={item} style={{ flexWrap: "wrap" }}>
                <span style={{ display: "flex", gap: 10, flex: 1, justifyContent: "space-between" }}>
                  {from === undefined ? (
                    <>
                      <span>{item}</span>
                      <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                        provenance unknown
                      </span>
                    </>
                  ) : (
                    <Link
                      href={linePath(from)}
                      style={{
                        color: "var(--cream)",
                        display: "flex",
                        gap: 10,
                        flex: 1,
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{item}</span>
                      <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                        line {from}
                      </span>
                    </Link>
                  )}
                </span>

                {onMint ? (
                  <button
                    type="button"
                    className="chip"
                    style={{ marginTop: 6 }}
                    disabled={Boolean(minting)}
                    onClick={() => onMint(item)}
                    title={
                      mintPrice
                        ? `Mint ${item} into a tradable form for ${mintPrice} GEN`
                        : `Mint ${item}`
                    }
                  >
                    {minting === item ? "minting..." : "mint"}
                  </button>
                ) : null}
              </span>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.5, color: "var(--muted)" }}>
        Every item links to the action that granted it.
        {onMint ? (
          <>
            {" "}
            Minting costs {mintPrice ?? "a fee"} GEN, joins the season pool, and
            settles on finality rather than on acceptance.
          </>
        ) : null}
      </div>

      {mintNote ? (
        <div className="mono" style={{ marginTop: 10, fontSize: 12, color: "var(--accent-text)" }}>
          {mintNote}
        </div>
      ) : null}
    </div>
  );
}
