import type { SourceKind, SourceMedia } from "./types";

export interface NativePickerAsset {
  uri: string;
  width: number;
  height: number;
  type?: "image" | "video" | "livePhoto" | "pairedVideo" | null;
  duration?: number | null;
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string | null;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  mov: "video/quicktime",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  png: "image/png",
  webm: "video/webm",
  webp: "image/webp"
};

function extensionOf(value: string): string {
  const cleanValue = value.split(/[?#]/, 1)[0] ?? value;
  return cleanValue.includes(".") ? (cleanValue.split(".").pop()?.toLowerCase() ?? "") : "";
}

function inferMimeType(asset: NativePickerAsset): string | null {
  if (asset.mimeType) {
    return asset.mimeType;
  }

  const extension = extensionOf(asset.fileName ?? asset.uri);
  return MIME_BY_EXTENSION[extension] ?? null;
}

function inferKind(asset: NativePickerAsset, mimeType: string): SourceKind | null {
  if (asset.type === "image" || asset.type === "video") {
    return asset.type;
  }

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  return mimeType.startsWith("video/") ? "video" : null;
}

function fallbackName(asset: NativePickerAsset, kind: SourceKind): string {
  const uriName = decodeURIComponent(asset.uri.split(/[\\/]/).pop()?.split(/[?#]/, 1)[0] ?? "");
  return asset.fileName?.trim() || uriName || `reactly-source.${kind === "image" ? "jpg" : "mp4"}`;
}

export function sourceFromNativeAsset(
  asset: NativePickerAsset,
  measuredSizeBytes?: number
): SourceMedia {
  const mimeType = inferMimeType(asset);
  if (!mimeType) {
    throw new Error("ReactLY could not determine that file's media type.");
  }

  const kind = inferKind(asset, mimeType);
  if (!kind) {
    throw new Error("Choose an image or video file.");
  }

  const source: SourceMedia = {
    uri: asset.uri,
    kind,
    width: asset.width,
    height: asset.height,
    name: fallbackName(asset, kind),
    mimeType,
    sizeBytes: asset.fileSize ?? measuredSizeBytes ?? 0,
    ...(kind === "video" ? { durationMs: asset.duration ?? undefined } : {})
  };
  return source;
}
