import { File } from "expo-file-system";

import ReactLYCompositor from "../../modules/reactly-compositor";
import { RectExportError } from "./errors";
import {
  createNativeExportPlan,
  NATIVE_EXPORT_FPS,
  NATIVE_EXPORT_HEIGHT,
  NATIVE_EXPORT_WIDTH
} from "./nativePlan";
import type { ExportProgressListener, RectExportInput, RectExportResult } from "./types";

export async function exportRect(
  input: RectExportInput,
  onProgress?: ExportProgressListener
): Promise<RectExportResult> {
  if (!ReactLYCompositor) {
    throw new RectExportError(
      "Native Rect export requires a ReactLY development build; it is not available in Expo Go."
    );
  }

  onProgress?.(0);
  try {
    const output = await ReactLYCompositor.exportAsync(createNativeExportPlan(input));
    const file = new File(output.uri);
    const sizeBytes = output.sizeBytes > 0 ? output.sizeBytes : file.size;
    if (!file.exists || sizeBytes <= 0) {
      throw new RectExportError("The native compositor returned an empty Rect.");
    }

    onProgress?.(1);
    return {
      uri: output.uri,
      mimeType: output.mimeType,
      sizeBytes,
      durationMs: input.reaction.durationMs,
      width: NATIVE_EXPORT_WIDTH,
      height: NATIVE_EXPORT_HEIGHT,
      fps: NATIVE_EXPORT_FPS
    };
  } catch (error) {
    if (error instanceof RectExportError) {
      throw error;
    }

    throw new RectExportError(
      error instanceof Error ? error.message : "ReactLY could not create the native Rect."
    );
  }
}

export function releaseRect(result: RectExportResult): void {
  try {
    const file = new File(result.uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // The operating system may already have cleared its temporary export file.
  }
}
