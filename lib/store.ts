import { Redis } from "@upstash/redis";
import { randomBytes } from "crypto";

/**
 * One record per physical claim card.
 * reserved  → card printed, no drawing yet
 * captured  → photo + timelapse uploaded, Herod draft pending
 * approved  → Nick approved Herod's note; visitor can claim
 * minting   → claim in progress (lock)
 * claimed   → on-chain, in the visitor's wallet
 */
export type PortraitStatus = "reserved" | "captured" | "approved" | "minting" | "claimed";

export type Portrait = {
  code: string; // secret token printed in the QR
  number: number; // card number printed on the card
  status: PortraitStatus;
  createdAt: string;
  capturedAt?: string;
  imageUrl?: string; // temporary Blob URL until minted
  timelapseUrl?: string;
  herod?: string;
  herodError?: string;
  sitterName?: string;
  // after minting
  asset?: string;
  owner?: string;
  signature?: string;
  arweaveImage?: string;
  arweaveVideo?: string;
  metadataUri?: string;
  claimedAt?: string;
  lastError?: string;
};

let client: Redis | null = null;
function redis(): Redis {
  if (client) return client;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Redis is not connected (KV_REST_API_URL / KV_REST_API_TOKEN missing).");
  client = new Redis({ url, token });
  return client;
}

const k = {
  portrait: (code: string) => `sf:p:${code}`,
  byNumber: (n: number) => `sf:n:${n}`,
  cardCounter: "sf:cards",
  nextToDraw: "sf:next",
  lock: (code: string) => `sf:lock:${code}`,
};

/** Unguessable, URL-safe, unambiguous characters (no 0/O/1/l). */
function newCode(): string {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function getPortrait(code: string): Promise<Portrait | null> {
  if (!/^[a-z0-9]{6,20}$/.test(code)) return null;
  return (await redis().get<Portrait>(k.portrait(code))) ?? null;
}

export async function savePortrait(p: Portrait): Promise<void> {
  await redis().set(k.portrait(p.code), p);
}

export async function getByNumber(n: number): Promise<Portrait | null> {
  const code = await redis().get<string>(k.byNumber(n));
  return code ? getPortrait(code) : null;
}

/** Reserve `count` new cards with consecutive numbers. */
export async function reserveCards(count: number): Promise<Portrait[]> {
  const r = redis();
  const last = await r.incrby(k.cardCounter, count);
  const first = last - count + 1;
  const out: Portrait[] = [];
  for (let n = first; n <= last; n++) {
    const p: Portrait = { code: newCode(), number: n, status: "reserved", createdAt: new Date().toISOString() };
    await r.set(k.portrait(p.code), p);
    await r.set(k.byNumber(n), p.code);
    out.push(p);
  }
  return out;
}

export async function cardCount(): Promise<number> {
  return (await redis().get<number>(k.cardCounter)) ?? 0;
}

/** The card number the booth will use for the next drawing. */
export async function nextCardNumber(): Promise<number> {
  return (await redis().get<number>(k.nextToDraw)) ?? 1;
}

export async function setNextCardNumber(n: number): Promise<void> {
  await redis().set(k.nextToDraw, n);
}

export async function listPortraits(): Promise<Portrait[]> {
  const total = await cardCount();
  const out: Portrait[] = [];
  for (let n = total; n >= 1; n--) {
    const p = await getByNumber(n);
    if (p) out.push(p);
  }
  return out;
}

/** Short lock so a double-tap can't mint twice. Returns false if already held. */
export async function acquireLock(code: string, seconds = 120): Promise<boolean> {
  const res = await redis().set(k.lock(code), "1", { nx: true, ex: seconds });
  return res === "OK";
}

export async function releaseLock(code: string): Promise<void> {
  await redis().del(k.lock(code));
}
