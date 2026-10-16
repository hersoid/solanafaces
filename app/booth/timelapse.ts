/** Grabs a still from the live camera at a given width. */
export function grabFrame(video: HTMLVideoElement, width: number, quality = 0.8): Promise<Blob> {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 960;
  const w = Math.min(width, vw);
  const h = Math.round((vh / vw) * w);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not capture frame"))), "image/jpeg", quality),
  );
}

/** Re-encodes any photo (HEIC, huge JPEG, PNG) as a JPEG of at most `maxSide` px. */
export async function normalizePhoto(file: Blob, maxSide = 2400): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * s);
    canvas.height = Math.round(img.naturalHeight * s);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read photo"))), "image/jpeg", 0.92),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function pickMime(): string | null {
  const options = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  if (typeof MediaRecorder === "undefined") return null;
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

/**
 * Turns the captured frames into a short video, entirely on the iPad
 * (no server-side video processing needed). Ends by holding the final photo.
 */
export async function encodeTimelapse(
  frames: Blob[],
  finalPhoto: Blob,
  opts: { fps?: number; maxFrames?: number; onProgress?: (p: number) => void } = {},
): Promise<Blob | null> {
  const mime = pickMime();
  if (!mime || frames.length < 4) return null;
  const fps = opts.fps ?? 15;
  const maxFrames = opts.maxFrames ?? 300;

  // Thin out very long sittings so the film stays around 20 seconds.
  const step = Math.max(1, Math.ceil(frames.length / maxFrames));
  const chosen = frames.filter((_, i) => i % step === 0);

  const first = await createImageBitmap(chosen[0]);
  const width = 720;
  const height = Math.round((first.height / first.width) * width / 2) * 2;
  first.close();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (recorder.onstop = () => r()));

  const draw = async (blob: Blob) => {
    const bmp = await createImageBitmap(blob);
    // fit (contain) on black
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    const s = Math.min(width / bmp.width, height / bmp.height);
    const w = bmp.width * s;
    const h = bmp.height * s;
    ctx.drawImage(bmp, (width - w) / 2, (height - h) / 2, w, h);
    bmp.close();
  };

  await draw(chosen[0]);
  recorder.start(500);
  const frameMs = 1000 / fps;
  for (let i = 0; i < chosen.length; i++) {
    const t0 = performance.now();
    await draw(chosen[i]);
    opts.onProgress?.(i / (chosen.length + fps * 2));
    const wait = frameMs - (performance.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  await draw(finalPhoto);
  await new Promise((r) => setTimeout(r, 2000)); // hold the finished drawing
  recorder.stop();
  await done;
  opts.onProgress?.(1);
  return new Blob(chunks, { type: mime.split(";")[0] });
}
