import { Camera } from "expo-camera";

import { CapturePreparationError } from "./errors";
import {
  createNativeCapturePreview,
  isNativeCapturePreview,
  nativePermissionFailure
} from "./nativeCapture";
import type { PreparedCapture } from "./types";

export async function prepareCapture(): Promise<PreparedCapture> {
  try {
    const [cameraPermission, microphonePermission] = await Promise.all([
      Camera.requestCameraPermissionsAsync(),
      Camera.requestMicrophonePermissionsAsync()
    ]);
    const failure = nativePermissionFailure(
      cameraPermission.granted,
      microphonePermission.granted
    );

    if (failure) {
      throw new CapturePreparationError(failure.code, failure.message);
    }

    return {
      preview: createNativeCapturePreview(),
      hasCamera: true,
      hasMicrophone: true
    };
  } catch (error) {
    if (error instanceof CapturePreparationError) {
      throw error;
    }

    throw new CapturePreparationError(
      "unknown",
      error instanceof Error
        ? error.message
        : "ReactLY could not prepare the camera and microphone."
    );
  }
}

export function stopCapture(capture: PreparedCapture): void {
  if (!isNativeCapturePreview(capture.preview)) {
    return;
  }

  const preview = capture.preview;
  const camera = preview.getCamera();
  if (camera) {
    void camera.pausePreview().catch(() => undefined);
  }
  preview.deactivate();
}
