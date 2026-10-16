import "server-only";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createGenericFile, keypairIdentity, publicKey, type Umi } from "@metaplex-foundation/umi";
import { mplCore } from "@metaplex-foundation/mpl-core";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";

export type Cluster = "devnet" | "mainnet-beta";

export function cluster(): Cluster {
  return process.env.SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet";
}

export function rpcUrl(): string {
  if (process.env.RPC_URL) return process.env.RPC_URL;
  return cluster() === "mainnet-beta" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com";
}

/** Accepts a base58 secret key or the JSON byte array most wallets export. */
export function minterKeypair(): Keypair {
  const raw = process.env.MINTER_SECRET_KEY?.trim();
  if (!raw) throw new Error("MINTER_SECRET_KEY is not set.");
  const bytes = raw.startsWith("[") ? Uint8Array.from(JSON.parse(raw) as number[]) : bs58.decode(raw);
  if (bytes.length !== 64) throw new Error("MINTER_SECRET_KEY must be a 64-byte secret key.");
  return Keypair.fromSecretKey(bytes);
}

export function collectionAddress(): string | null {
  return process.env.COLLECTION_ADDRESS?.trim() || null;
}

export function royaltyBps(): number {
  const n = Number(process.env.ROYALTY_BPS ?? 500);
  return Number.isFinite(n) && n >= 0 && n <= 2000 ? Math.round(n) : 500;
}

let cached: Umi | null = null;
export function umi(): Umi {
  if (cached) return cached;
  const kp = minterKeypair();
  const u = createUmi(rpcUrl(), "confirmed").use(mplCore());
  const signer = u.eddsa.createKeypairFromSecretKey(kp.secretKey);
  u.use(keypairIdentity(signer));
  u.use(
    irysUploader(
      cluster() === "devnet" ? { address: "https://devnet.irys.xyz" } : { address: "https://uploader.irys.xyz" },
    ),
  );
  cached = u;
  return u;
}

/** Permanent storage on Arweave, paid in SOL from the minting wallet. */
export async function uploadFile(bytes: Uint8Array, fileName: string, contentType: string): Promise<string> {
  const file = createGenericFile(bytes, fileName, { contentType });
  const [uri] = await umi().uploader.upload([file]);
  return uri;
}

export async function uploadJson(data: unknown): Promise<string> {
  return umi().uploader.uploadJson(data);
}

export async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch ${url} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export function isValidAddress(address: string): boolean {
  try {
    publicKey(address);
    return bs58.decode(address).length === 32;
  } catch {
    return false;
  }
}

export function explorerTx(signature: string): string {
  const c = cluster() === "devnet" ? "?cluster=devnet" : "";
  return `https://solscan.io/tx/${signature}${c}`;
}

export function explorerAddress(address: string): string {
  const c = cluster() === "devnet" ? "?cluster=devnet" : "";
  return `https://solscan.io/account/${address}${c}`;
}
