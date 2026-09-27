export { prepareCapture, stopCapture } from "./captureAdapter";
export { cancelRecording, releaseReaction, startRecording, stopRecording } from "./recordingAdapter";
export { CapturePreparationError } from "./errors";
export {
  createNativeCapturePreview,
  isNativeCapturePreview,
  nativePermissionFailure
} from "./nativeCapture";
export type { NativeCapturePreview } from "./nativeCapture";
export { nativeRecordingMimeType } from "./nativeRecordingMetadata";
export type {
  ActiveRecording,
  CapturedReaction,
  CaptureErrorCode,
  CaptureFailure,
  PreparedCapture
} from "./types";
