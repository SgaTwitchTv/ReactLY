import type { CameraView } from "expo-camera";
import { File } from "expo-file-system";
import { Platform } from "react-native";

import { CapturePreparationError } from "./errors";
import { isNativeCapturePreview } from "./nativeCapture";
import { nativeRecordingMimeType, type NativeMobilePlatform } from "./nativeRecordingMetadata";
import type { ActiveRecording, CapturedReaction, PreparedCapture } from "./types";

interface NativeRecordingHandle {
  camera: CameraView;
  completion: Promise<{ uri: string } | undefined>;
  stopRequested: boolean;
  reactionOwned: boolean;
}

function recordingHandle(recording: ActiveRecording): NativeRecordingHandle {
  const handle = recording.nativeHandle;
  if (
    typeof handle !== "object" ||
    handle === null ||
    !("camera" in handle) ||
    !("completion" in handle) ||
    !(handle.completion instanceof Promise)
  ) {
    throw new CapturePreparationError("recording-failed", "The native recording handle is invalid.");
  }

  return handle as NativeRecordingHandle;
}

function deleteTemporaryRecording(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // The operating system may already have cleared its temporary camera file.
  }
}

export function startRecording(capture: PreparedCapture): ActiveRecording {
  if (!isNativeCapturePreview(capture.preview) || !capture.preview.isActive()) {
    throw new CapturePreparationError("recording-failed", "The native camera session is inactive.");
  }

  const camera = capture.preview.getCamera();
  if (!capture.preview.isReady() || !camera) {
    throw new CapturePreparationError("recording-failed", "Wait for the front camera to become ready.");
  }

  const completion = camera.recordAsync();
  return {
    nativeHandle: { camera, completion, stopRequested: false, reactionOwned: false } satisfies NativeRecordingHandle,
    startedAtMs: Date.now()
  };
}

export async function stopRecording(recording: ActiveRecording): Promise<CapturedReaction> {
  const handle = recordingHandle(recording);
  if (handle.stopRequested) {
    throw new CapturePreparationError("recording-failed", "The reaction recording already stopped.");
  }

  handle.stopRequested = true;
  handle.camera.stopRecording();

  try {
    const result = await handle.completion;
    if (!result?.uri) {
      throw new CapturePreparationError(
        "recording-failed",
        "The native camera did not return a reaction video."
      );
    }

    const file = new File(result.uri);
    if (!file.exists || file.size <= 0) {
      deleteTemporaryRecording(result.uri);
      throw new CapturePreparationError("recording-failed", "The recorded reaction was empty.");
    }

    // The captured reaction now owns this file. Cleanup of the active handle
    // runs when the screen transitions to captured and must not delete it.
    handle.reactionOwned = true;
    return {
      uri: result.uri,
      mimeType: nativeRecordingMimeType(result.uri, Platform.OS as NativeMobilePlatform),
      sizeBytes: file.size,
      durationMs: Math.max(1, Date.now() - recording.startedAtMs)
    };
  } catch (error) {
    if (error instanceof CapturePreparationError) {
      throw error;
    }

    throw new CapturePreparationError(
      "recording-failed",
      error instanceof Error ? error.message : "ReactLY could not finish the native recording."
    );
  }
}

export async function cancelRecording(recording: ActiveRecording): Promise<void> {
  const handle = recordingHandle(recording);
  if (handle.reactionOwned) {
    return;
  }
  if (!handle.stopRequested) {
    handle.stopRequested = true;
    handle.camera.stopRecording();
  }

  const result = await handle.completion.catch(() => undefined);
  if (result?.uri && !handle.reactionOwned) {
    deleteTemporaryRecording(result.uri);
  }
}

export function releaseReaction(reaction: CapturedReaction): void {
  deleteTemporaryRecording(reaction.uri);
}
