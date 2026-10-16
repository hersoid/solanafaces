import "server-only";
import { assetJson, assetName } from "../metadata";
import { collectionAddress, fetchBytes, uploadFile, uploadJson } from "../solana";
import type { Portrait } from "../store";
import { mintDirect } from "./metaplex";
import { mintViaMallow } from "./mallow";

export function mintDriver(): "metaplex" | "mallow" {
  return process.env.MINT_DRIVER === "mallow" ? "mallow" : "metaplex";
}

/**
 * Uploads the drawing (and timelapse) to Arweave, writes the metadata,
 * and mints the portrait into `owner`'s wallet.
 * Uploads are reused if a previous attempt got that far.
 */
export async function mintPortrait(p: Portrait, owner: string): Promise<Portrait> {
  const collection = collectionAddress();
  if (!collection) throw new Error("COLLECTION_ADDRESS is not set yet. Create the collection on /booth/setup.");
  if (!p.imageUrl) throw new Error("This portrait has no photo yet.");

  const next: Portrait = { ...p };

  if (!next.arweaveImage) {
    next.arweaveImage = await uploadFile(await fetchBytes(p.imageUrl), `solanaface-${p.number}.jpg`, "image/jpeg");
  }
  if (p.timelapseUrl && !next.arweaveVideo) {
    const isMp4 = p.timelapseUrl.includes(".mp4");
    next.arweaveVideo = await uploadFile(
      await fetchBytes(p.timelapseUrl),
      `solanaface-${p.number}.${isMp4 ? "mp4" : "webm"}`,
      isMp4 ? "video/mp4" : "video/webm",
    );
  }
  if (!next.metadataUri) {
    next.metadataUri = await uploadJson(assetJson(next, next.arweaveImage, next.arweaveVideo));
  }

  const args = { name: assetName(p), uri: next.metadataUri, owner, collection };
  const result = mintDriver() === "mallow" ? await mintViaMallow(args) : await mintDirect(args);

  return {
    ...next,
    status: "claimed",
    asset: result.asset,
    signature: result.signature,
    owner,
    claimedAt: new Date().toISOString(),
    lastError: undefined,
  };
}
