import { Asset, requestPermissionsAsync } from "expo-media-library";
import * as Sharing from "expo-sharing";

import { RectExportError } from "./errors";
import { rectFileName } from "./saveFileName";
import type { RectExportResult } from "./types";

export async function saveRect(result: RectExportResult): Promise<string> {
  const permission = await requestPermissionsAsync(true, ["video"]);
  if (!permission.granted) {
    throw new RectExportError(
      "ReactLY needs permission to add this finished Rect to your media library."
    );
  }

  try {
    await Asset.create(result.uri);
  } catch (error) {
    throw new RectExportError(
      error instanceof Error
        ? `ReactLY could not save this Rect: ${error.message}`
        : "ReactLY could not save this Rect to your media library."
    );
  }

  return rectFileName(result);
}

export async function shareRect(result: RectExportResult): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new RectExportError("The system share sheet is unavailable on this device.");
  }

  try {
    await Sharing.shareAsync(result.uri, {
      dialogTitle: "Share your ReactLY Rect",
      mimeType: result.mimeType,
      UTI: "public.mpeg-4"
    });
  } catch (error) {
    throw new RectExportError(
      error instanceof Error
        ? `ReactLY could not share this Rect: ${error.message}`
        : "ReactLY could not open the system share sheet."
    );
  }
}
