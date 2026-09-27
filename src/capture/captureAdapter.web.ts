import { CapturePreparationError } from "./errors";
import type { PreparedCapture } from "./types";

function errorFromBrowser(error: unknown): CapturePreparationError {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
    return new CapturePreparationError(
      "permission-denied",
      "Camera and microphone access was denied. Allow both permissions and try again."
    );
  }

  if (error instanceof DOMException && error.name === "NotFoundError") {
    return new CapturePreparationError(
      "unavailable",
      "ReactLY could not find both a camera and microphone on this device."
    );
  }

  return new CapturePreparationError(
    "unknown",
    error instanceof Error ? error.message : "ReactLY could not prepare the camera and microphone."
  );
}

export async function prepareCapture(): Promise<PreparedCapture> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CapturePreparationError(
      "unavailable",
      "Camera and microphone access requires a supported browser on localhost or HTTPS."
    );
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { facingMode: "user" }
    });
    const hasCamera = stream.getVideoTracks().length > 0;
    const hasMicrophone = stream.getAudioTracks().length > 0;

    if (!hasCamera || !hasMicrophone) {
      stream.getTracks().forEach((track) => track.stop());
      throw new CapturePreparationError(
        "missing-track",
        "ReactLY needs both a camera and microphone before recording."
      );
    }

    return { preview: stream, hasCamera, hasMicrophone };
  } catch (error) {
    if (error instanceof CapturePreparationError) {
      throw error;
    }

    throw errorFromBrowser(error);
  }
}

export function stopCapture(capture: PreparedCapture): void {
  const stream = capture.preview;
  if (stream instanceof MediaStream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}
