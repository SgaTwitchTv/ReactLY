export class SourcePickerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourcePickerError";
  }
}
