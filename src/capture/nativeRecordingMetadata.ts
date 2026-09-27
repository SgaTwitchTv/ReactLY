export type NativeMobilePlatform = "android" | "ios";

export function nativeRecordingMimeType(
  uri: string,
  platform: NativeMobilePlatform
): string {
  const cleanUri = uri.split(/[?#]/, 1)[0]?.toLowerCase() ?? uri.toLowerCase();
  if (cleanUri.endsWith(".mov")) {
    return "video/quicktime";
  }

  if (cleanUri.endsWith(".webm")) {
    return "video/webm";
  }

  return platform === "ios" ? "video/quicktime" : "video/mp4";
}
