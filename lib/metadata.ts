import type { Portrait } from "./store";

export const COLLECTION_NAME = "Solanafaces";
export const ARTIST = "HERSOID";
export const VENUE = "Solana Spaces, Solana Breakpoint 2026, Olympia London";

export function pad(n: number): string {
  return String(n).padStart(3, "0");
}

export function assetName(p: Portrait): string {
  return `Solanaface No. ${pad(p.number)}`;
}

function sittingDate(p: Portrait): string {
  const d = new Date(p.capturedAt ?? p.createdAt);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
}

/** Off-chain JSON (Metaplex standard), written to Arweave. */
export function assetJson(p: Portrait, imageUri: string, videoUri?: string) {
  const files: { uri: string; type: string }[] = [{ uri: imageUri, type: "image/jpeg" }];
  if (videoUri) files.push({ uri: videoUri, type: videoUri.endsWith(".webm") ? "video/webm" : "video/mp4" });
  return {
    name: assetName(p),
    symbol: "SFACE",
    description: `${p.herod ?? ""}\n\n— Herod Hersché\n\nGraphite on paper, drawn from life by ${ARTIST} at ${VENUE}, ${sittingDate(p)}. One of one; the paper original was given to the sitter.`.trim(),
    image: imageUri,
    ...(videoUri ? { animation_url: videoUri } : {}),
    external_url: "https://hersoid.com",
    attributes: [
      { trait_type: "Artist", value: ARTIST },
      { trait_type: "Card", value: pad(p.number) },
      { trait_type: "Medium", value: "Graphite on paper" },
      { trait_type: "Venue", value: "Solana Spaces, Breakpoint London" },
      { trait_type: "Date", value: sittingDate(p) },
      { trait_type: "Critic", value: "Herod Hersché" },
      ...(p.sitterName ? [{ trait_type: "Sitter", value: p.sitterName }] : []),
    ],
    properties: { category: videoUri ? "video" : "image", files },
  };
}

export function collectionJson(imageUri: string) {
  return {
    name: COLLECTION_NAME,
    symbol: "SFACE",
    description:
      "Solanafaces at Solana Spaces. A human photo booth: portraits drawn by hand from life by HERSOID at Solana Breakpoint 2026, Olympia London, each annotated by the critic Herod Hersché and minted for its sitter.",
    image: imageUri,
    external_url: "https://hersoid.com",
    properties: { category: "image", files: [{ uri: imageUri, type: "image/jpeg" }] },
  };
}
