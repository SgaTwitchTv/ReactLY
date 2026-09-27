import { SourcePickerError } from "./errors";
import type { SourceMedia, SourcePickerResult } from "./types";
import { sourceKindFromMimeType, validateSourceMedia } from "./validation";

function readImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new SourcePickerError("ReactLY could not read that image."));
    image.src = uri;
  });
}

function readVideoMetadata(
  uri: string
): Promise<{ width: number; height: number; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        durationMs: video.duration * 1000
      });
    };
    video.onerror = () => reject(new SourcePickerError("ReactLY could not read that video."));
    video.src = uri;
  });
}

async function sourceFromFile(file: File): Promise<SourceMedia> {
  const kind = sourceKindFromMimeType(file.type);
  if (!kind) {
    throw new SourcePickerError("Choose an image or video file.");
  }

  const uri = URL.createObjectURL(file);

  try {
    const metadata =
      kind === "image" ? await readImageDimensions(uri) : await readVideoMetadata(uri);
    const source: SourceMedia = {
      uri,
      kind,
      width: metadata.width,
      height: metadata.height,
      name: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      ...(kind === "video" && "durationMs" in metadata
        ? { durationMs: Number(metadata.durationMs) }
        : {})
    };
    const validation = validateSourceMedia(source);

    if (!validation.valid) {
      throw new SourcePickerError(`The selected file is invalid: ${validation.issues.join(", ")}.`);
    }

    return source;
  } catch (error) {
    URL.revokeObjectURL(uri);
    throw error;
  }
}

export function pickSource(): Promise<SourcePickerResult> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    let settled = false;

    function cleanup() {
      input.remove();
    }

    function resolveOnce(result: SourcePickerResult) {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(result);
    }

    input.type = "file";
    input.accept = "image/*,video/*";
    input.setAttribute("aria-hidden", "true");
    input.style.display = "none";
    input.onchange = () => {
      const file = input.files?.item(0) ?? null;
      if (!file) {
        resolveOnce({ status: "cancelled" });
        return;
      }

      void sourceFromFile(file)
        .then((source) => resolveOnce({ status: "selected", source }))
        .catch((error: unknown) => {
          if (!settled) {
            settled = true;
            cleanup();
            reject(error);
          }
        });
    };
    input.addEventListener("cancel", () => resolveOnce({ status: "cancelled" }), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

export function releaseSource(source: SourceMedia): void {
  URL.revokeObjectURL(source.uri);
}
