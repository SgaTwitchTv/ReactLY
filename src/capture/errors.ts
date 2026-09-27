import type { CaptureErrorCode } from "./types";

export class CapturePreparationError extends Error {
  constructor(
    public readonly code: CaptureErrorCode,
    message: string
  ) {
    super(message);
    this.name = "CapturePreparationError";
  }
}
