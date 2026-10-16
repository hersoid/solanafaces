import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isBooth } from "@/lib/auth";

/** Issues short-lived upload tokens to the booth app only. Files go straight from the iPad to Blob storage. */
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        if (!(await isBooth())) throw new Error("Booth login required.");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/heic", "video/webm", "video/mp4"],
          maximumSizeInBytes: 60 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
