import "server-only";
import { generateSigner, publicKey } from "@metaplex-foundation/umi";
import { create, createCollection, fetchCollection, ruleSet } from "@metaplex-foundation/mpl-core";
import bs58 from "bs58";
import { umi, royaltyBps } from "../solana";

/**
 * Direct Metaplex Core path. Works on devnet and mainnet.
 * Mints straight into the visitor's wallet in a single transaction.
 */
export async function mintDirect(opts: {
  name: string;
  uri: string;
  owner: string;
  collection: string;
}): Promise<{ asset: string; signature: string }> {
  const u = umi();
  const asset = generateSigner(u);
  const collection = await fetchCollection(u, publicKey(opts.collection));
  const { signature } = await create(u, {
    asset,
    collection,
    name: opts.name,
    uri: opts.uri,
    owner: publicKey(opts.owner),
  }).sendAndConfirm(u, { confirm: { commitment: "confirmed" } });
  return { asset: asset.publicKey.toString(), signature: bs58.encode(signature) };
}

/** One-off: creates the Solanafaces collection with royalties enforced at collection level. */
export async function createCollectionDirect(opts: {
  name: string;
  uri: string;
}): Promise<{ collection: string; signature: string }> {
  const u = umi();
  const collection = generateSigner(u);
  const creator = u.identity.publicKey;
  const { signature } = await createCollection(u, {
    collection,
    name: opts.name,
    uri: opts.uri,
    plugins: [
      {
        type: "Royalties",
        basisPoints: royaltyBps(),
        creators: [{ address: creator, percentage: 100 }],
        ruleSet: ruleSet("None"),
      },
    ],
  }).sendAndConfirm(u, { confirm: { commitment: "confirmed" } });
  return { collection: collection.publicKey.toString(), signature: bs58.encode(signature) };
}
