import { CapturePreparationError } from "./errors";
import type { ActiveRecording, CapturedReaction, PreparedCapture } from "./types";

interface WebRecordingHandle {
  recorder: MediaRecorder;
  chunks: Blob[];
  completion: Promise<Blob>;
  resolveCompletion: (blob: Blob) => void;
  rejectCompletion: (error: Error) => void;
}

const PREFERRED_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm"
] as const;

function selectMimeType(): string | undefined {
  return PREFERRED_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function webHandle(recording: ActiveRecording): WebRecordingHandle {
  const handle = recording.nativeHandle;
  if (
    typeof handle !== "object" ||
    handle === null ||
    !("recorder" in handle) ||
    !(handle.recorder instanceof MediaRecorder)
  ) {
    throw new CapturePreparationError("recording-failed", "The active recording handle is invalid.");
  }

  return handle as WebRecordingHandle;
}

export function startRecording(capture: PreparedCapture): ActiveRecording {
  if (typeof MediaRecorder === "undefined") {
    throw new CapturePreparationError(
      "unavailable",
      "This browser does not support local reaction recording."
    );
  }

  const stream = capture.preview;
  if (!(stream instanceof MediaStream) || stream.getTracks().some((track) => track.readyState !== "live")) {
    throw new CapturePreparationError(
      "recording-failed",
      "The camera or microphone stream is no longer active."
    );
  }

  const mimeType = selectMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  let resolveCompletion: (blob: Blob) => void = () => undefined;
  let rejectCompletion: (error: Error) => void = () => undefined;
  const completion = new Promise<Blob>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });
  const handle: WebRecordingHandle = {
    recorder,
    chunks: [],
    completion,
    resolveCompletion,
    rejectCompletion
  };

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      handle.chunks.push(event.data);
    }
  };
  recorder.onerror = () => {
    handle.rejectCompletion(
      new CapturePreparationError("recording-failed", "The browser could not record this reaction.")
    );
  };
  recorder.onstop = () => {
    handle.resolveCompletion(new Blob(handle.chunks, { type: recorder.mimeType || "video/webm" }));
  };
  recorder.start(250);

  return { nativeHandle: handle, startedAtMs: Date.now() };
}

export async function stopRecording(recording: ActiveRecording): Promise<CapturedReaction> {
  const handle = webHandle(recording);
  if (handle.recorder.state === "inactive") {
    throw new CapturePreparationError("recording-failed", "The reaction recording already stopped.");
  }

  handle.recorder.stop();
  const blob = await handle.completion;
  if (blob.size === 0) {
    throw new CapturePreparationError("recording-failed", "The recorded reaction was empty.");
  }

  return {
    uri: URL.createObjectURL(blob),
    mimeType: blob.type || "video/webm",
    sizeBytes: blob.size,
    durationMs: Math.max(1, Date.now() - recording.startedAtMs)
  };
}

export async function cancelRecording(recording: ActiveRecording): Promise<void> {
  const handle = webHandle(recording);
  if (handle.recorder.state !== "inactive") {
    handle.recorder.stop();
  }

  await handle.completion;
}

export function releaseReaction(reaction: CapturedReaction): void {
  URL.revokeObjectURL(reaction.uri);
}
