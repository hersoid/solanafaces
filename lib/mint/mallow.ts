import "server-only";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { cluster, minterKeypair, rpcUrl, royaltyBps } from "../solana";

/**
 * mallow v2 path (mainnet only — the API has no devnet).
 * mallow builds the transactions; we sign and broadcast them exactly as returned.
 * Docs: https://docs.mallow.art/api/v2/transactions/mint-asset
 *
 * The mint builder has no recipient field, so the minting wallet receives the asset
 * and a second mallow-built transaction transfers it to the visitor.
 *
 * NOTE: mallow's docs do not spell out the shapes of `creators` and `collection`.
 * The shapes below are our best reading; run the dry run on /booth/setup to
 * confirm mallow accepts them before switching MINT_DRIVER to "mallow".
 */

const API = "https://api.mallow.art";

export class MallowError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string) {
    super(message);
  }
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const key = process.env.MALLOW_API_KEY;
  if (!key) throw new Error("MALLOW_API_KEY is not set.");
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(API + path, {
      method: "POST",
      headers: { "x-api-key": key, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (res.ok) return JSON.parse(text) as T;
    let err: { message?: string; code?: string } | undefined;
    try {
      err = JSON.parse(text).error;
    } catch {}
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === 3) throw new MallowError(res.status, err?.message ?? text, err?.code);
    const wait = res.status === 429 ? Number(res.headers.get("retry-after") || 10) * 1000 : 1000 * 2 ** attempt;
    await new Promise((r) => setTimeout(r, Math.min(wait, 20000)));
  }
}

function mintBody(opts: { name: string; uri: string; collection: string; asset: string; authority: string }) {
  return {
    kind: "core_asset",
    authority: opts.authority,
    asset: opts.asset,
    uri: opts.uri,
    nftMetadata: {
      name: opts.name,
      sellerFeeBasisPoints: royaltyBps(),
      creators: [{ address: opts.authority, share: 100 }], // shape to confirm via dry run
    },
    collection: { address: opts.collection, tokenStandard: "core-collection" }, // shape to confirm via dry run
  };
}

async function signAndSend(conn: Connection, b64: string, signers: Keypair[]): Promise<string> {
  const tx = VersionedTransaction.deserialize(Buffer.from(b64, "base64"));
  tx.sign(signers); // adds our signatures, keeps any mallow already added
  const signature = await conn.sendRawTransaction(tx.serialize(), { maxRetries: 5 });
  // mallow stamps its own blockhash, so poll the signature rather than block height.
  for (let i = 0; i < 40; i++) {
    const { value } = await conn.getSignatureStatuses([signature]);
    const s = value[0];
    if (s?.err) throw new Error(`Transaction failed: ${JSON.stringify(s.err)}`);
    if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return signature;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Transaction not confirmed in time: ${signature}`);
}

export async function mintViaMallow(opts: {
  name: string;
  uri: string;
  owner: string;
  collection: string;
}): Promise<{ asset: string; signature: string; mintSignature: string }> {
  if (cluster() !== "mainnet-beta") throw new Error("mallow minting is mainnet only; use MINT_DRIVER=metaplex on devnet.");
  const minter = minterKeypair();
  const assetKp = Keypair.generate();
  const conn = new Connection(rpcUrl(), "confirmed");

  const built = await call<{ result: { tx: string } }>(
    "/v2/tx/nft/mint",
    mintBody({ ...opts, asset: assetKp.publicKey.toBase58(), authority: minter.publicKey.toBase58() }),
  );
  const mintSignature = await signAndSend(conn, built.result.tx, [minter, assetKp]);

  const transfer = await call<{ result: { tx: string } }>("/v2/tx/assets/transfer", {
    authority: minter.publicKey.toBase58(),
    asset: assetKp.publicKey.toBase58(),
    recipient: opts.owner,
    tokenStandard: "core",
    tagFeeAccount: true,
  });
  const signature = await signAndSend(conn, transfer.result.tx, [minter]);
  return { asset: assetKp.publicKey.toBase58(), signature, mintSignature };
}

/** Builds a mint transaction without signing or sending it. Costs nothing. */
export async function mallowDryRun(collection: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const minter = minterKeypair();
    const assetKp = Keypair.generate();
    const built = await call<{ result: { tx: string } }>(
      "/v2/tx/nft/mint",
      mintBody({
        name: "Solanaface dry run",
        uri: "https://arweave.net/placeholder",
        collection,
        asset: assetKp.publicKey.toBase58(),
        authority: minter.publicKey.toBase58(),
      }),
    );
    const tx = VersionedTransaction.deserialize(Buffer.from(built.result.tx, "base64"));
    const n = tx.message.compiledInstructions.length;
    return { ok: true, detail: `mallow built a valid mint transaction (${n} instructions). Nothing was signed or sent.` };
  } catch (e) {
    const m = e instanceof MallowError ? `mallow said ${e.status}: ${e.message}` : (e as Error).message;
    return { ok: false, detail: m };
  }
}
