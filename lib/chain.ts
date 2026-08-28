// The single place that decides WHICH GenLayer network the whole app talks to.
//
// Questline runs on the Studio network. As of 2026-07-29 the GenLayer team
// confirmed Bradbury has a network-side fault where a deploy reports FINALIZED
// with result_code 0 and written storage, and gen_getContractCode then answers
// "contract code not found at address". Nothing in the contract causes it.
//
// Flip back with one env var once Bradbury is healthy again:
//   NEXT_PUBLIC_GENLAYER_NETWORK=bradbury
//
// Everything below is derived from genlayer-js's own chain objects rather than
// retyped, so the chain id, RPC url and explorer cannot drift out of sync with
// the SDK. Retyping them is how a sibling project ended up handing wallets an
// explorer host that does not exist.

import { studionet, testnetBradbury } from "genlayer-js/chains";

export type NetworkId = "studionet" | "bradbury";

const RAW = (process.env.NEXT_PUBLIC_GENLAYER_NETWORK || "studionet")
  .trim()
  .toLowerCase();

export const NETWORK: NetworkId =
  RAW === "bradbury" || RAW === "testnet_bradbury" || RAW === "testnetbradbury"
    ? "bradbury"
    : "studionet";

export const IS_STUDIO = NETWORK === "studionet";

/** The genlayer-js chain object to hand to createClient(). */
export const CHAIN = IS_STUDIO ? studionet : testnetBradbury;

export const NETWORK_LABEL = IS_STUDIO ? "GENLAYER STUDIO" : "TESTNET BRADBURY";

export const CHAIN_ID_HEX = `0x${CHAIN.id.toString(16)}` as const;

export const RPC_URL = CHAIN.rpcUrls.default.http[0];

/**
 * Explorer base url, or "" when the active network has no working one.
 *
 * genlayer-js points studionet at https://genlayer-explorer.vercel.app, which
 * answered 503 on every request when it was last checked. Emitting "view
 * transaction" links into a dead host is worse than emitting none, so Studio
 * defaults to no explorer and the interface drops the link rather than
 * shipping a dead one.
 */
const EXPLORER_BASE = (
  process.env.NEXT_PUBLIC_GENLAYER_EXPLORER ??
  (IS_STUDIO ? "" : CHAIN.blockExplorers?.default?.url || "")
).replace(/\/+$/, "");

export const HAS_EXPLORER = EXPLORER_BASE.length > 0;

export function explorerTx(hash: string): string {
  return EXPLORER_BASE ? `${EXPLORER_BASE}/tx/${hash}` : "";
}

export function explorerAddress(address: string): string {
  return EXPLORER_BASE ? `${EXPLORER_BASE}/address/${address}` : "";
}

/**
 * Studio reports eth_gasPrice = 0 and does not fund arbitrary wallets - there
 * is no Studio faucet, and an ordinary MetaMask address reads zero GEN there.
 * So a pre-flight "you have no GEN" guard, which is correct on Bradbury, would
 * refuse every single write on Studio before it was ever attempted.
 *
 * On Studio the transaction itself is the judge: if it really does need gas,
 * the wallet says so and readableError surfaces it.
 */
export const REQUIRES_GAS = !IS_STUDIO;

/** Null when the active network has no faucet (Studio). */
export const FAUCET_URL: string | null = IS_STUDIO
  ? null
  : "https://testnet-faucet.genlayer.foundation/";

export const ADD_CHAIN_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: CHAIN.name,
  rpcUrls: [...CHAIN.rpcUrls.default.http],
  nativeCurrency: CHAIN.nativeCurrency,
  ...(EXPLORER_BASE ? { blockExplorerUrls: [EXPLORER_BASE] } : {}),
};

const RAW_ADDRESS = (process.env.NEXT_PUBLIC_QUESTLINE_ADDRESS || "").trim();

/**
 * The contract address, exactly as configured.
 *
 * Deliberately NOT lowercased. `gen_call` wants the EIP-55 checksummed spelling
 * and answers "Contract not found" for the all-lowercase one - which is the
 * opposite of the rule inside the contract, where a TreeMap key must be
 * lowercased on both sides. Normalising here is how a sibling project spent
 * hours watching a live site silently serve seeded data.
 *
 * There is no checksumming done for you, because doing it needs keccak and
 * getting it subtly wrong would be worse than the honest warning below.
 */
export const QUESTLINE = RAW_ADDRESS as `0x${string}`;

/**
 * False until a contract address is configured. The site then runs the seeded
 * demonstration world and says so on every page, rather than showing empty
 * panels or, worse, sample numbers dressed as chain state.
 */
export const IS_LIVE = /^0x[0-9a-fA-F]{40}$/.test(QUESTLINE);

/**
 * True when the configured address is all one case, which `gen_call` rejects.
 *
 * A mixed-case address is already checksummed. An all-lowercase or all-uppercase
 * one is the shape that fails, and it fails by looking like an empty world
 * rather than like an error - so it is worth saying out loud rather than
 * debugging twice.
 */
export const ADDRESS_LOOKS_UNCHECKSUMMED =
  IS_LIVE &&
  (RAW_ADDRESS.slice(2) === RAW_ADDRESS.slice(2).toLowerCase() ||
    RAW_ADDRESS.slice(2) === RAW_ADDRESS.slice(2).toUpperCase());

if (ADDRESS_LOOKS_UNCHECKSUMMED && typeof window === "undefined") {
  // eslint-disable-next-line no-console
  console.warn(
    `[questline] NEXT_PUBLIC_QUESTLINE_ADDRESS is ${RAW_ADDRESS}, which is not ` +
      `EIP-55 checksummed. gen_call answers "Contract not found" for that ` +
      `spelling, so every read will fail and the site will serve the seeded ` +
      `world. Use the mixed-case address the deploy script printed.`
  );
}

/* Resolution order for the canonical origin, and each step earns its place.
 *
 * An explicit NEXT_PUBLIC_ORIGIN always wins, so a real domain can be pinned
 * once there is one. Failing that Vercel hands every build its own production
 * domain, which is what lets a first deploy produce correct chronicle
 * permalinks and share cards with nothing configured at all. The literal is the
 * last resort, for local runs.
 *
 * The NEXT_PUBLIC_ prefixed copy of the Vercel variable is deliberate: this
 * module is imported by client components, and the bare
 * VERCEL_PROJECT_PRODUCTION_URL is server only, so it would inline as undefined
 * in the browser bundle and fall through to the literal.
 */
const VERCEL_PRODUCTION_URL =
  process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

export const ORIGIN =
  process.env.NEXT_PUBLIC_ORIGIN ||
  (VERCEL_PRODUCTION_URL
    ? `https://${VERCEL_PRODUCTION_URL}`
    : "https://questline.worlds");

/**
 * The same thing without the scheme, for places that print the domain as a
 * name rather than link to it.
 *
 * Derived rather than written down. The domain appeared as a literal in the
 * footer, the share card and the permalink label, so changing it meant finding
 * four files and missing one; now it is this constant and the env var behind
 * it.
 */
export const HOST = ORIGIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
