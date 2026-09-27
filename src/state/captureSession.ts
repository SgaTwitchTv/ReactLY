import type { PreparedCapture } from "../capture/types";

export type CaptureSessionState =
  | { status: "idle"; capture: null; error: null }
  | { status: "requesting-permission"; capture: null; error: null }
  | { status: "ready"; capture: PreparedCapture; error: null }
  | { status: "error"; capture: null; error: string };

export type CaptureSessionEvent =
  | { type: "permission-requested" }
  | { type: "capture-prepared"; capture: PreparedCapture }
  | { type: "capture-failed"; message: string }
  | { type: "capture-stopped" };

export const initialCaptureSession: CaptureSessionState = {
  status: "idle",
  capture: null,
  error: null
};

export function captureSessionReducer(
  state: CaptureSessionState,
  event: CaptureSessionEvent
): CaptureSessionState {
  switch (event.type) {
    case "permission-requested":
      return { status: "requesting-permission", capture: null, error: null };
    case "capture-prepared":
      return { status: "ready", capture: event.capture, error: null };
    case "capture-failed":
      return { status: "error", capture: null, error: event.message };
    case "capture-stopped":
      return initialCaptureSession;
    default:
      return state;
  }
}
