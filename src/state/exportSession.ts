import type { RectExportResult } from "../export/types";

export type ExportSessionState =
  | { status: "idle"; progress: 0; result: null; error: null }
  | { status: "exporting"; progress: number; result: null; error: null }
  | { status: "ready"; progress: 1; result: RectExportResult; error: null }
  | { status: "error"; progress: 0; result: null; error: string };

export type ExportSessionEvent =
  | { type: "export-started" }
  | { type: "export-progressed"; progress: number }
  | { type: "export-finished"; result: RectExportResult }
  | { type: "export-failed"; message: string }
  | { type: "export-reset" };

export const initialExportSession: ExportSessionState = {
  status: "idle",
  progress: 0,
  result: null,
  error: null
};

export function exportSessionReducer(
  state: ExportSessionState,
  event: ExportSessionEvent
): ExportSessionState {
  switch (event.type) {
    case "export-started":
      return { status: "exporting", progress: 0, result: null, error: null };
    case "export-progressed":
      return state.status === "exporting"
        ? {
            status: "exporting",
            progress: Math.max(0, Math.min(1, event.progress)),
            result: null,
            error: null
          }
        : state;
    case "export-finished":
      return { status: "ready", progress: 1, result: event.result, error: null };
    case "export-failed":
      return { status: "error", progress: 0, result: null, error: event.message };
    case "export-reset":
      return initialExportSession;
    default:
      return state;
  }
}
