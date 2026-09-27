# ReactLY architecture

### 2026-09-13: native recording ownership correction

- On the Samsung S24 Ultra, completed recordings disappeared from the camera
  cache: transitioning to captured ran active-handle cancellation, which deleted
  the same file handed to the preview and exporter.
- Successful native stop now transfers file ownership to the captured reaction.
  Active-handle cleanup preserves transferred files; explicit reaction release
  still deletes them on discard/replacement. Unfinished cancellation still cleans
  up its file. This shared native fix applies to Android and iOS.
- Regression tests cover stop followed by cleanup, unfinished cancellation, and
  overlapping stop/cleanup. Fresh device recording/playback/export verification
  remains pending; existing deleted recordings cannot be recovered by this fix.

## Foundation

Use Expo/React Native with Expo Router and TypeScript. Target Android, iOS, and
web from one repository while accepting that cross-app capture will eventually
need platform-specific native code.

## Proposed modules

```text
app/                    routes and screens
src/capture/            permissions and camera session
src/media/              source selection and metadata
src/composition/        deterministic timeline and render graph
src/export/             platform export implementations
src/components/         reusable UI
src/theme/              tokens, typography, spacing
modules/                future local Expo native modules
docs/                   product source of truth
```

## Interfaces

```ts
interface SourceMedia {
  uri: string;
  kind: "image" | "video";
  width: number;
  height: number;
  durationMs?: number;
}

interface CaptureSession {
  start(source: SourceMedia): Promise<void>;
  stop(): Promise<CapturedReaction>;
  cancel(): Promise<void>;
}

interface RectExporter {
  export(input: ExportInput): Promise<ExportResult>;
}
```

## Platform strategy

### Web

- MediaDevices for front camera and microphone
- Canvas or WebCodecs composition
- MediaRecorder for early local export

### Android

- Expo development build
- Camera and media selection first
- Future React Anywhere mode through MediaProjection, foreground service, and
  a local Expo module

### iOS

- Camera and media selection first
- Future source import through Share Sheet/share extension
- Evaluate ReplayKit separately; do not assume Android-style overlays

## Data handling

Phase 1 is device-local. Do not introduce a backend, analytics SDK, or media
upload. Keep exported Rects in user-selected local storage.

## Known decision points

- Native compositor: platform media APIs versus Skia/FFmpeg-style pipeline
- Maximum source and recording duration
- Target export codec and container by platform
- Frame rate and device performance floor
- When a backend becomes necessary

Record decisions here with date, rationale, and consequences.

## Decisions

### 2026-09-13: Android compositor stack and texture sizing

- The S24 Ultra exported playable media, but the brand covered both media planes
  after the one-second hold. Media3 1.10.1 draws its first sequence on top;
  ReactLY had supplied canvas-style background-first ordering.
- Android sequences now run foreground-first: source-front, reaction,
  source-back, brand. The corresponding input IDs change together, preserving
  the sampled source/reaction foreground handoff and placing branding underneath.
- Media-plane shaders now output the export canvas dimensions while still
  sampling the original image/video with cover crop. Media3 scales textures by
  intrinsic dimensions; normalizing them ensures the planned rectangle fractions
  produce the intended on-screen sizes regardless of input resolution.
- These changes affect Android export only. A rebuilt APK and newly generated
  Rect are required; existing exports retain the old composition. Visual device
  confirmation of the updated transition remains pending.

### 2026-07-25: deterministic composition geometry

- The shared `layoutAt` function owns export geometry and uses pixel values
  derived only from time and canvas size.
- The initial camera card uses 31% of canvas width with a 3:4 viewport.
- The final source card uses 41% of canvas width with a 16:9 viewport.
- Both cards use a 4% canvas-width edge margin.
- These aspect ratios are provisional presentation windows. Source and reaction
  media will use cover crop within them and will never be stretched.
- Platform exporters must consume this shared timeline rather than reproduce
  timing or easing independently.

### 2026-07-27: web-first local source picker

- Source metadata and validation are shared, while selection and resource
  cleanup live behind platform-resolved adapters.
- Web selection uses the browser's local file chooser and in-memory object URLs.
  Selected media is not uploaded or persisted.
- The web adapter reads image dimensions and video dimensions/duration before a
  source can enter the ready state.
- Android and iOS selection was initially unavailable; the native picker
  decision below supersedes that temporary adapter behavior.
- No maximum file size or source duration is imposed yet. Those limits remain a
  measured performance decision before export work begins.

### 2026-07-27: capture preparation ownership

- Permission/preparation state is a pure reducer and remains separate from both
  source-selection state and exported composition state.
- The web capture adapter requests the front-facing camera and microphone
  together. A session is ready only when both tracks exist.
- The adapter owns browser `MediaStream` cleanup. Tracks stop when the source is
  replaced or removed, capture is cancelled, or the screen unmounts.
- The live preview is mirrored and remains inside the lower-right camera card.
  It never runs the exported role-swap animation.
- Android and iOS camera preparation was initially unavailable; the native
  camera decision below supersedes that temporary adapter behavior.
- This slice prepares a live stream only. `MediaRecorder`, recording duration,
  captured files, and export audio mixing remain out of scope.

### 2026-07-27: local web reaction recording

- Recording lifecycle is a pure state machine: idle, recording, stopping,
  captured, or error. It does not own source selection or export composition.
- The web adapter records the prepared camera and microphone stream with
  `MediaRecorder`, preferring WebM VP9/Opus, then VP8/Opus, then browser-default
  WebM support.
- Stopping creates one local object URL plus MIME type, byte size, and measured
  duration. Cancelling creates no user-facing asset.
- Captured reaction URLs are revoked on re-record, source reset, or unmount.
  Prepared camera tracks remain active after a successful stop so re-recording
  does not require another permission prompt.
- The live creator composition stays source-first throughout recording. This
  raw reaction file does not contain the source or the exported role swap.
- Native recording was initially unavailable; the native recording decision
  below supersedes that temporary adapter behavior.

### 2026-07-27: first web Rect compositor

- The first web exporter renders a 720×1280 canvas at 30 FPS and encodes WebM.
- Every frame consumes shared `layoutAt` geometry. Exporters may not duplicate
  the 1000 ms hold, 650 ms transition, easing, or card sizing.
- Media uses centered cover crop. The reaction is mirrored consistently with
  the live front-camera preview; neither media plane is stretched.
- The black brand layer is drawn first, so its watermark and positioning line
  are visible only where moving media uncovers it.
- Foreground ownership changes deterministically at 1325 ms: reaction is above
  source before the role-swap midpoint, and source is above reaction afterward.
  This is the prototype's explicit physical-layer handoff.
- Microphone audio from the raw reaction is routed into the export through Web
  Audio. Source audio is intentionally omitted in this first pass to keep the
  genuine reaction intelligible; source-audio policy remains a product decision.
- Output is currently WebM with browser-selected VP9/Opus, VP8/Opus, or default
  WebM support. MP4, native export, cancellation, and measured device
  performance remain future work.

### 2026-07-27: local web save

- Saving remains device-local and uses a browser download backed by the existing
  export object URL. No media is uploaded or copied to application storage.
- Download names use `ReactLY-YYYYMMDD-HHmmssZ.webm`, with UTC timestamps so they
  are filesystem-safe and deterministic. The extension follows the export MIME
  type so a future MP4 exporter can reuse the same naming boundary.
- The exported object URL stays alive so the creator can preview or download the
  Rect again. It is revoked only when the export is replaced, discarded, or the
  screen unmounts.
- Native saving was deferred until native export output existed; the native
  save/share decision below now supersedes that temporary limitation.

### 2026-07-27: native local source picker

- Android and iOS source selection uses Expo ImagePicker's system library UI and
  accepts one image or video without editing, recompression, or multiple selection.
- iOS requests photo-library permission before opening the picker because original
  passthrough video access can otherwise trigger a surprising permission prompt
  after selection. Android uses the operating system picker without a preliminary
  broad-library permission request.
- Picker metadata is normalized into the same `SourceMedia` shape used on web.
  Missing MIME types are inferred only from known file extensions; missing file
  size falls back to Expo FileSystem. Invalid or incomplete metadata is rejected.
- ReactLY retains the picker-provided local URI and does not copy, upload, or delete
  the user's original asset. Cache lifecycle remains owned by the operating system.
- This slice is implementation-verified through TypeScript and unit tests. Android
  and iOS device verification remain open until a simulator or physical device is
  connected; the later native recording decision extends this implementation.

### 2026-07-27: native capture preparation and preview

- Android and iOS request camera and microphone permissions together through
  Expo Camera. Capture becomes prepared only when both permissions are granted;
  partial permission is reported explicitly and never treated as a usable session.
- The mounted native `CameraView` uses the front camera, video mode, and mirrored
  preview inside the existing lower-right lime-outlined card. The creator view
  remains source-first and performs no exported role-swap animation.
- The prepared capture owns a typed lifecycle controller for the single mounted
  `CameraView`, with controlled attach, ready, and deactivate operations. Rendering
  owns mounting; the future recording adapter will consume the camera only after
  `onCameraReady` fires.
- Stopping capture marks the handle inactive, pauses the preview when mounted,
  and clears the reference. Replacing/removing a source and screen unmount use
  the same existing cleanup path.
- Barcode scanning is disabled in native configuration to avoid unrelated binary
  weight. Android audio recording permission remains enabled for the next slice.
- Android production bundling verifies module/config integration. Physical-device
  preview and permission verification remain open; the recording implementation
  is specified below.

### 2026-07-27: native reaction recording and preview

- The native recording adapter starts Expo Camera's `recordAsync` only when the
  prepared front-camera controller is active, mounted, and ready. The pending
  recording promise is stored behind the shared opaque `ActiveRecording` handle.
- Stop signals the same mounted camera, awaits its cache-file result, and returns
  shared reaction metadata derived from the local file. Android defaults to MP4;
  iOS defaults to QuickTime unless the returned extension identifies otherwise.
- The mirrored `CameraView` remains in the source-first lower-right card while
  recording, and microphone audio is enabled by native configuration. No live
  role-swap or source capture is introduced.
- Cancellation waits for the camera to finish closing its file and deletes that
  temporary result. Captured files are likewise deleted on re-record, source
  reset, or unmount through the existing `releaseReaction` lifecycle.
- Native raw-reaction review uses Expo Video with native playback controls and a
  texture-backed Android view. The player is created by `useVideoPlayer` so it is
  released automatically when the preview unmounts.
- No recording duration or file-size cap is imposed yet, matching the current web
  prototype. Native composition/export remains unavailable, and real-device audio,
  orientation, mirroring, and interruption behavior still require verification.

### 2026-07-27: native compositor boundary and frame plan

- Expo SDK 57 provides capture and playback but no supported offline API for
  composing multiple visual tracks into a new video. ReactLY therefore uses a
  local Expo module named `ReactLYCompositor`; it requires a development build
  and intentionally remains unavailable in Expo Go.
- Android's target engine is Jetpack Media3 Transformer. iOS's target engine is
  AVFoundation video composition/export. This avoids retired FFmpegKit binaries,
  cloud rendering, and media uploads while using maintained platform facilities.
- JavaScript remains the single owner of ReactLY timing. `createNativeExportPlan`
  samples the shared `layoutAt` and `layerOrderAt` functions at 30 FPS into an
  explicit versioned frame plan. Native engines must consume those rectangles,
  radii, opacity values, and foreground decisions; they must not reproduce the
  easing or phase boundaries independently.
- The bridge contract fixes Phase 1 native output at 720x1280, 30 FPS, with the
  reaction mirrored, reaction audio retained, video sources looped, image sources
  held, and the brand layer supplied as explicit colors and text.
- The native export adapter now handles module availability, plan submission,
  output-file validation, progress boundaries, and temporary-file cleanup. The
  local module is autolinkable on Android and Apple platforms.
- The Android module now parses and validates that versioned plan, drives a Media3
  multi-sequence composition at the plan timestamps, retains only reaction audio,
  mirrors the reaction, switches visual foreground by using a duplicate video-only
  source layer, and writes a local H.264/AAC MP4 with cancellation/error cleanup.
- Android generates the supplied ReactLY brand canvas as a temporary, full-size
  local PNG and composites it as the lowest video sequence. Its visibility follows
  each frame's `brandOpacity`; the temporary image is deleted on completion,
  cancellation, synchronous startup failure, or asynchronous export failure.
- Native plan parsing now retains and validates both corner radii and brand opacity
  so Android visual effects consume the same sampled timeline as web.
- Source and reaction items now use an SDR Media3 GL effect before placement. The
  effect calculates a centered cover crop from decoded input dimensions and the
  current planned rectangle, applies the current rounded mask, and draws a narrow
  lime inner outline whenever the plane is a rounded card. Full-screen planes have
  zero radius and therefore no outline. Mirroring remains a compositor transform.
- The Android implementation is code-complete for the canonical Phase 1 visual
  contract. Its Kotlin/GLSL compositor and the complete debug application compile
  successfully with JDK 17 and the installed Android SDK. Real-device export checks
  remain open for shader orientation, alpha blending, codec compatibility, audio
  retention, source-video looping, cancellation, save/share, and playback.
- The iOS module now validates the same versioned plan and renders each planned
  frame locally with AVFoundation decoding plus a Core Graphics BGRA pixel-buffer
  canvas. Both planes use centered cover crop, sampled corner radii, lime card
  outlines, sampled foreground ownership, and consistent reaction mirroring over
  the supplied black brand layer and opacity-driven watermark.
- iOS encodes the rendered frames as a 720x1280 H.264 MP4, then uses an
  `AVMutableComposition` and `AVAssetExportSession` to attach only the original
  reaction microphone track. Still images are normalized for orientation, source
  videos loop against their measured asset duration, output and intermediate files
  remain temporary/local, and failures remove partial output.
- The iOS implementation is code-complete but cannot be compiled or exercised on
  this Windows workstation. A macOS/Xcode development build and physical-device
  checks remain mandatory for frame orientation, Core Graphics alpha/edge quality,
  decode performance, audio synchronization, cancellation, and codec compatibility.
- Native save/share and real-device verification on both mobile platforms remain
  part of Stage 1.

### 2026-07-28: native local save and share

- Android and iOS expose two explicit actions after export: save the finished MP4
  to the device media library or open the operating system share sheet. Neither
  action uploads media or sends it anywhere without the creator choosing a target.
- Save requests write-only media-library access limited to video. iOS receives a
  purpose-specific add-only usage description; Android uses the SDK's scoped media
  behavior. A denied permission is reported without deleting the temporary Rect,
  so the creator can still preview or share it.
- Sharing uses the local MP4 URI, `video/mp4`, and the MPEG-4 UTI. Closing the system
  sheet returns to the ready Rect without treating cancellation as export failure.
- Browser behavior remains a direct local download with a filesystem-safe ReactLY
  filename. The shared save API is asynchronous on every platform so permission
  prompts and browser/mobile behavior have one typed boundary.
- Native exported-Rect review now uses Expo Video controls instead of the earlier
  placeholder. Save/share permissions, library insertion, share targets, and video
  playback still require Android and iOS development-build verification.

### 2026-07-28: Android prebuild verification

- A clean Expo Android prebuild completes from repository configuration. The
  generated manifest contains camera, microphone, and video-media permissions,
  and Expo autolinking resolves the local `ReactLYCompositor` together with Camera,
  FileSystem, Media Library, Sharing, System UI, and Video modules.
- `expo-system-ui` is now an explicit SDK-matched dependency so the declared dark
  native appearance is applied without the prebuild configuration warning.
- Android's production Metro/Hermes export completes and emits the `.hbc` bundle.
  TypeScript, lint, and all unit tests also pass after native project generation.
- Android Studio's SDK, platform tools, CMake, and Ninja are available locally, and
  Temurin JDK 17 is installed for the Expo/Gradle toolchain. The local compositor
  compiles successfully and a complete debug APK packages at
  `android/app/build/outputs/apk/debug/app-debug.apk`.
- React Native's generated C++ object paths exceed Ninja's 260-character limit at
  this repository's normal Windows path. Native prebuild and packaging were therefore
  run through a short `C:\ReactLYBuild` directory junction pointing at the repository;
  this changes no tracked source paths or application behavior.
- `adb` is installed and responds, but no phone or emulator was connected during
  this check. APK installation and the real-device capture/export acceptance pass
  remain open, as does the separate macOS/Xcode iOS verification pass.
