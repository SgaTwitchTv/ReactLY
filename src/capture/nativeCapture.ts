import type { CameraView } from "expo-camera";

import type { CaptureFailure } from "./types";

export interface NativeCapturePreview {
  attachCamera(camera: CameraView | null): void;
  markReady(): void;
  markUnavailable(): void;
  deactivate(): void;
  getCamera(): CameraView | null;
  isReady(): boolean;
  isActive(): boolean;
}

export function createNativeCapturePreview(): NativeCapturePreview {
  let camera: CameraView | null = null;
  let ready = false;
  let active = true;

  return {
    attachCamera(nextCamera) {
      camera = active ? nextCamera : null;
      if (!nextCamera) {
        ready = false;
      }
    },
    markReady() {
      ready = active && camera !== null;
    },
    markUnavailable() {
      ready = false;
    },
    deactivate() {
      active = false;
      ready = false;
      camera = null;
    },
    getCamera: () => camera,
    isReady: () => ready,
    isActive: () => active
  };
}

export function nativePermissionFailure(
  hasCameraPermission: boolean,
  hasMicrophonePermission: boolean
): CaptureFailure | null {
  if (hasCameraPermission && hasMicrophonePermission) {
    return null;
  }

  const missing = [
    !hasCameraPermission ? "camera" : null,
    !hasMicrophonePermission ? "microphone" : null
  ].filter((permission): permission is string => permission !== null);

  return {
    code: "permission-denied",
    message: `ReactLY needs ${missing.join(" and ")} permission to record your reaction.`
  };
}

export function isNativeCapturePreview(value: unknown): value is NativeCapturePreview {
  return (
    typeof value === "object" &&
    value !== null &&
    "attachCamera" in value &&
    "getCamera" in value &&
    "isReady" in value &&
    "isActive" in value
  );
}
