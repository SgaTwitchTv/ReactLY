# Capture and exported-video specification

This file is normative. If code and this document disagree, stop and resolve the
conflict before continuing.

## Creator recording view

The creator's on-device recording view remains stable for the entire recording:

- Source media fills the vertical canvas.
- Front-camera preview appears in the bottom-right.
- The camera preview uses a lime outline.
- Minimal controls and a clear recording indicator remain visible.
- No source/camera role-swap animation occurs during recording.

This preserves the source for the people reacting and keeps the creator focused
on capturing the moment.

## Export timeline

Target canvas: vertical 9:16. Timeline values are measured from the beginning of
the exported Rect.

### 0–1000 ms: reveal

- Source fills the canvas using cover-crop behavior.
- Reaction camera is picture-in-picture in the bottom-right.
- Camera PiP target width: 30–32% of canvas.
- A lime outline distinguishes the reaction camera.
- Microphone audio begins immediately.

### 1000–1650 ms: role swap

- Use a 650 ms smooth transition.
- Reaction camera expands from the bottom-right to full-screen.
- Source shrinks from full-screen to the lower-left.
- A black brand layer is behind both moving media planes.
- A subtle centered `ReactLY` watermark and the line `DON'T COMMENT. REACT.`
  appear only where the moving media reveals the brand layer.
- Rounded corners on the expanding camera interpolate toward zero.
- Rounded corners on the shrinking source interpolate toward the final card
  radius.
- The transition should feel like two physical layers rearranging, not a cut.

Initial prototype easing: cubic ease-out. Later polish may use a tuned spring,
motion blur, parallax, sound design, and haptics while preserving this timeline.

### 1650 ms–end: reaction focus

- Reaction camera fills the canvas with cover-crop behavior.
- Source remains in the lower-left.
- Source target width: 40–42% of canvas.
- Source card uses a lime outline and rounded corners.
- The reaction is the visual subject.

## Media behavior

- Images remain still for the entire recording.
- Video sources begin at the start of capture and may loop in the prototype.
- Preserve source aspect ratio using cover crop; never stretch.
- Mirror the front-camera preview and export consistently.
- Include microphone audio in the exported result.

## Deterministic timeline function

Implement the role swap as a pure function:

```ts
layoutAt(timeMs, canvasSize) => {
  sourceRect,
  cameraRect,
  sourceRadius,
  cameraRadius,
  brandOpacity,
  phase
}
```

Unit-test boundary values at 0, 999, 1000, 1325, 1650, and after 1650 ms.
