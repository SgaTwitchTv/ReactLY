import type { ActiveRecording, CapturedReaction } from "../capture/types";

export type RecordingSessionState =
  | { status: "idle"; active: null; reaction: null; error: null }
  | { status: "recording"; active: ActiveRecording; reaction: null; error: null }
  | { status: "stopping"; active: ActiveRecording; reaction: null; error: null }
  | { status: "captured"; active: null; reaction: CapturedReaction; error: null }
  | { status: "error"; active: null; reaction: null; error: string };

export type RecordingSessionEvent =
  | { type: "recording-started"; active: ActiveRecording }
  | { type: "recording-stop-requested" }
  | { type: "recording-captured"; reaction: CapturedReaction }
  | { type: "recording-failed"; message: string }
  | { type: "recording-reset" };

export const initialRecordingSession: RecordingSessionState = {
  status: "idle",
  active: null,
  reaction: null,
  error: null
};

export function recordingSessionReducer(
  state: RecordingSessionState,
  event: RecordingSessionEvent
): RecordingSessionState {
  switch (event.type) {
    case "recording-started":
      return { status: "recording", active: event.active, reaction: null, error: null };
    case "recording-stop-requested":
      return state.status === "recording"
        ? { status: "stopping", active: state.active, reaction: null, error: null }
        : state;
    case "recording-captured":
      return { status: "captured", active: null, reaction: event.reaction, error: null };
    case "recording-failed":
      return { status: "error", active: null, reaction: null, error: event.message };
    case "recording-reset":
      return initialRecordingSession;
    default:
      return state;
  }
}
