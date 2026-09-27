export class RectExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RectExportError";
  }
}
