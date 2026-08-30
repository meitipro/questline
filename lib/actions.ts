"use client";

/**
 * Writes, from the browser wallet.
 *
 * A write here is not a token transfer. Several validators each run a graded
 * prompt over the same evidence and have to agree, which takes long enough that
 * the transaction's stage is part of the interface rather than something hidden
 * behind a spinner. Every function takes an `onStage` callback for that reason.
 *
 * The acceptance rule the whole app follows: records and status changes act on
 * ACCEPTED, because a game that waits for finality on every turn is unplayable.
 * Anything that moves value out of the contract waits for FINALIZED, because a
 * reversal after a payout cannot be undone.
 */

import { createClient } from "genlayer-js";
import { TransactionStatus } from "genlayer-js/types";

import {
  ADD_CHAIN_PARAMS,
  CHAIN,
  CHAIN_ID_HEX,
  FAUCET_URL,
  IS_LIVE,
  QUESTLINE,
  REQUIRES_GAS,
} from "./chain";
import type { Line, WriteStage } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Stage = (stage: WriteStage, note?: string) => void;

function provider(): any {
  const eth = (globalThis as any).ethereum;
  if (!eth) throw new Error("no_wallet");
  return eth;
}

function writeClient(address: `0x${string}`) {
  return createClient({
    chain: CHAIN as any,
    account: address as any,
    provider: provider(),
  } as any);
}

async function ensureNetwork(): Promise<void> {
  const eth = provider();
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (e: any) {
    const code = e?.code ?? e?.data?.originalError?.code;
    // 4902 is "the wallet has never heard of this chain", which is the normal
    // first run on a network as young as this one.
    if (code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [ADD_CHAIN_PARAMS],
      });
    } else {
      throw e;
    }
  }
}

export async function connectWallet(): Promise<string> {
  const accounts: string[] = await provider().request({
    method: "eth_requestAccounts",
  });
  await ensureNetwork();
  return accounts[0];
}

export async function currentAccount(): Promise<string | null> {
  const eth = (globalThis as any).ethereum;
  if (!eth) return null;
  try {
    const accounts: string[] = await eth.request({ method: "eth_accounts" });
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

function requireLive() {
  if (!IS_LIVE) throw new Error("not_deployed");
}

/**
 * genlayer-js puts a method's return value in different places depending on the
 * shape of the receipt, and `act` returns the resolved chronicle line, which is
 * the whole point of the turn. So it is dug out rather than assumed.
 */
function resultOf(receipt: any): unknown {
  const candidates = [
    receipt?.result,
    receipt?.data?.result,
    receipt?.returnValue,
    receipt?.data?.returnValue,
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null && c !== "") return c;
  }
  return null;
}

function parseLine(value: unknown): Line | null {
  if (!value) return null;
  try {
    const blob = typeof value === "string" ? JSON.parse(value) : value;
    if (blob && typeof blob === "object" && "roll" in (blob as any)) {
      return blob as Line;
    }
  } catch {
    /* fall through: the turn resolved, the receipt just did not carry it */
  }
  return null;
}

/**
 * Whether the contract's own code actually ran.
 *
 * A GenLayer receipt has three fields that all look like success, and only one
 * of them answers the question. `status` is the TRANSACTION's state - a refused
 * call finalizes perfectly well. `result` is the CONSENSUS outcome - validators
 * agreeing that a call failed is still agreement. The answer lives in
 * `consensus_data.leader_receipt[].execution_result`.
 *
 * This is not theoretical. Questline's very first real action on chain came back
 * ACCEPTED and wrote nothing: the leader had died inside the contract, and every
 * write path here would have reported it as a turn that worked. A player would
 * have watched their energy not move and had no idea why.
 *
 * Picks the round whose mode is "leader" rather than index 0 - later rounds are
 * validators, and a cancelled validator round after quorum is normal. Returns
 * rather than throws when the shape is unfamiliar: inventing a failure from a
 * receipt we cannot read would be its own bug.
 */
function assertExecuted(receipt: any, what: string): void {
  const rounds =
    receipt?.consensus_data?.leader_receipt ??
    receipt?.data?.consensus_data?.leader_receipt;
  if (!Array.isArray(rounds) || rounds.length === 0) return;

  const leader = rounds.find((r: any) => r?.mode === "leader") ?? rounds[0];
  const executed = leader?.execution_result;
  if (executed === undefined || executed === "SUCCESS") return;

  // The refusal sentence is plain text one level down, under result.payload,
  // for both a raised UserError and an immediate rollback.
  const payload = leader?.result?.payload;
  const message =
    typeof payload === "string" && payload.trim()
      ? stripErrorTag(payload)
      : `${what} was accepted by the network but the contract did not run it`;
  throw new Error(message);
}

export async function enterWorld(
  address: `0x${string}`,
  onStage?: Stage
): Promise<string> {
  requireLive();
  const client = writeClient(address);

  onStage?.("signing");
  const hash = await client.writeContract({
    address: QUESTLINE,
    functionName: "enter",
    args: [],
  } as any);

  onStage?.("sent", "the world is making room for you");
  const entered: any = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  } as any);
  assertExecuted(entered, "entering the world");
  onStage?.("accepted");
  return hash;
}

/**
 * One action, one transaction. The resolution is the moment of the game, so the
 * caller narrates each stage instead of spinning.
 */
export async function act(
  address: `0x${string}`,
  text: string,
  onStage?: Stage
): Promise<{ hash: string; line: Line | null; votes?: string }> {
  requireLive();
  const client = writeClient(address);

  onStage?.("signing");
  const hash = await client.writeContract({
    address: QUESTLINE,
    functionName: "act",
    args: [text],
  } as any);

  onStage?.("sent", "the world is considering your action");

  // Read on acceptance. The chronicle line and the state change are records,
  // and a turn that waited for the appeal window would not be a game.
  const accepted: any = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  } as any);
  assertExecuted(accepted, "your action");
  onStage?.("accepted");

  const votes = describeVotes(accepted);
  return { hash, line: parseLine(resultOf(accepted)), votes };
}

/**
 * "5 of 5", when the receipt carries the votes.
 *
 * Returns undefined rather than a guess when it does not. The agreement count is
 * exactly the sort of number this product must never invent, so a line whose
 * votes are unknown shows no votes row at all.
 */
function describeVotes(receipt: any): string | undefined {
  const votes =
    receipt?.consensus_data?.validators ??
    receipt?.data?.consensus_data?.validators ??
    receipt?.votes ??
    null;
  if (Array.isArray(votes) && votes.length > 0) {
    const agreed = votes.filter((v: any) => isAgreement(v?.vote ?? v?.result ?? v)).length;
    return `${agreed} of ${votes.length}`;
  }
  if (votes && typeof votes === "object") {
    const entries = Object.values(votes as Record<string, unknown>);
    if (entries.length > 0) {
      const agreed = entries.filter(isAgreement).length;
      return `${agreed} of ${entries.length}`;
    }
  }
  return undefined;
}

/**
 * Whether one validator's vote was agreement.
 *
 * MATCHED EXACTLY, NEVER BY SUBSTRING. This read `vote.includes("agree")`, and
 * "disagree".includes("agree") is true, so every disagreement was counted as an
 * agreement: a two of five split rendered as "5 of 5" under the resolution
 * feed, in the affirmative colour.
 *
 * Of every defect in this repository that is the one that mattered most. The
 * page exists to say that several strangers had to agree, and it was printing a
 * unanimity that had not happened. A product that invents its own consensus
 * number has no argument left.
 */
function isAgreement(raw: unknown): boolean {
  const vote = String(raw ?? "").trim().toLowerCase();
  return vote === "agree" || vote === "agreed" || vote === "true" || vote === "1";
}

export async function buySeasonPass(
  address: `0x${string}`,
  priceWei: bigint,
  onStage?: Stage
): Promise<string> {
  requireLive();
  const client = writeClient(address);

  onStage?.("signing");
  const hash = await client.writeContract({
    address: QUESTLINE,
    functionName: "buy_season_pass",
    args: [],
    value: priceWei,
  } as any);

  onStage?.("sent", "paying into the season pool");
  const paid: any = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  } as any);
  assertExecuted(paid, "the payment");
  onStage?.("accepted", "accepted, waiting for the appeal window to close");

  // This one moved money. Nothing says paid until it can no longer be reversed.
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
  } as any);
  onStage?.("finalized");
  return hash;
}

export async function mintItem(
  address: `0x${string}`,
  name: string,
  priceWei: bigint,
  onStage?: Stage
): Promise<string> {
  requireLive();
  const client = writeClient(address);

  onStage?.("signing");
  const hash = await client.writeContract({
    address: QUESTLINE,
    functionName: "mint_item",
    args: [name],
    value: priceWei,
  } as any);

  onStage?.("sent", "minting from the line that granted it");
  const minted: any = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  } as any);
  assertExecuted(minted, "the mint");
  onStage?.("accepted", "accepted, the mint settles on finality");

  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
  } as any);
  onStage?.("finalized");
  return hash;
}

/**
 * The contract's error strings are written for people to read, so they are shown
 * as they are rather than replaced with a generic failure.
 */
export function readableError(e: any): string {
  const raw =
    e?.message ??
    e?.data?.message ??
    e?.shortMessage ??
    (typeof e === "string" ? e : "");

  if (/user rejected|denied|4001/i.test(raw)) return "You cancelled the signature.";
  if (/no_wallet/.test(raw))
    return "No wallet was found in this browser, so nothing can be signed.";
  if (/not_deployed/.test(raw))
    return "The contract is not deployed yet, so the world cannot be written to.";
  if (/insufficient funds|insufficient balance/i.test(raw)) {
    return REQUIRES_GAS && FAUCET_URL
      ? `Not enough GEN in this account. This is a testnet, so top it up at ${FAUCET_URL}`
      : "The network refused the transaction for lack of gas.";
  }

  // The interesting failures come back carrying the contract's own sentence,
  // and those sentences were written to be read by a player.
  const match = /UserError\(?['"]?(.+?)['"]?\)?$/.exec(raw);
  return stripErrorTag(match ? match[1] : raw) || "The transaction failed.";
}

/**
 * Remove the contract's error classification prefix.
 *
 * `[EXPECTED]` and `[LLM_ERROR]` exist so validators can compare two failures
 * correctly - a deterministic refusal must match exactly, a model fault must
 * force a rotation. They are consensus machinery and mean nothing to a player,
 * so they are stripped before the sentence is shown.
 */
export function stripErrorTag(message: string): string {
  return message.replace(/^\s*\[[A-Z_]+\]\s*/, "").trim();
}

/**
 * "you are out of energy for this cycle, the next one starts at 2026-07-30T20:03:11Z"
 * is correct and unreadable. The stamp is turned into the relative form the
 * energy meter already uses, and the rest of the sentence is kept verbatim.
 */
export function humaniseStamps(message: string, now: Date = new Date()): string {
  return message.replace(
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})Z?/g,
    (stamp) => {
      const ms = new Date(`${stamp}Z`).getTime() - now.getTime();
      if (!Number.isFinite(ms)) return stamp;
      if (ms <= 0) return "now";
      const total = Math.floor(ms / 1000);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      return h === 0 ? `in ${m}m` : `in ${h}h ${String(m).padStart(2, "0")}m`;
    }
  );
}
