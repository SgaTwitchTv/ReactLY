import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import { SourcePickerError } from "./errors";
import { sourceFromNativeAsset } from "./nativeAsset";
import type { SourceMedia, SourcePickerResult } from "./types";
import { validateSourceMedia } from "./validation";

export async function pickSource(): Promise<SourcePickerResult> {
  if (Platform.OS === "ios") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new SourcePickerError("Allow photo-library access to choose a ReactLY source.");
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    allowsEditing: false,
    allowsMultipleSelection: false,
    selectionLimit: 1,
    quality: 1,
    shouldDownloadFromNetwork: true
  });

  if (result.canceled) {
    return { status: "cancelled" };
  }

  const asset = result.assets[0];
  if (!asset) {
    throw new SourcePickerError("ReactLY did not receive the selected media.");
  }

  let measuredSizeBytes: number | undefined;
  if (asset.fileSize === undefined) {
    try {
      measuredSizeBytes = new File(asset.uri).size;
    } catch {
      measuredSizeBytes = undefined;
    }
  }

  let source: SourceMedia;
  try {
    source = sourceFromNativeAsset(asset, measuredSizeBytes);
  } catch (error) {
    throw new SourcePickerError(
      error instanceof Error ? error.message : "ReactLY could not read the selected media."
    );
  }

  const validation = validateSourceMedia(source);
  if (!validation.valid) {
    throw new SourcePickerError(`The selected file is invalid: ${validation.issues.join(", ")}.`);
  }

  return { status: "selected", source };
}

export function releaseSource(_source: SourceMedia): void {
  // The system picker owns the selected asset URI. ReactLY does not copy or delete it.
}
