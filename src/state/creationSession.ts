import type { SourceMedia } from "../media/types";

export type CreationSession =
  | { status: "idle"; source: null; error: null }
  | { status: "selecting-source"; source: null; error: null }
  | { status: "source-ready"; source: SourceMedia; error: null }
  | { status: "source-error"; source: null; error: string };

export type CreationSessionEvent =
  | { type: "source-selection-started" }
  | { type: "source-selected"; source: SourceMedia }
  | { type: "source-selection-cancelled" }
  | { type: "source-selection-failed"; message: string }
  | { type: "source-cleared" };

export const initialCreationSession: CreationSession = {
  status: "idle",
  source: null,
  error: null
};

export function creationSessionReducer(
  state: CreationSession,
  event: CreationSessionEvent
): CreationSession {
  switch (event.type) {
    case "source-selection-started":
      return { status: "selecting-source", source: null, error: null };
    case "source-selected":
      return { status: "source-ready", source: event.source, error: null };
    case "source-selection-cancelled":
    case "source-cleared":
      return initialCreationSession;
    case "source-selection-failed":
      return { status: "source-error", source: null, error: event.message };
    default:
      return state;
  }
}
