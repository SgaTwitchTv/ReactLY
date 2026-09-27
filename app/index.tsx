import { useEffect, useReducer, useRef, useState } from "react";
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  cancelRecording,
  prepareCapture,
  releaseReaction,
  startRecording,
  stopCapture,
  stopRecording
} from "@/src/capture";
import { CameraPreview } from "@/src/components/CameraPreview";
import { ReactionPreview } from "@/src/components/ReactionPreview";
import { RectPreview } from "@/src/components/RectPreview";
import { SourcePreview } from "@/src/components/SourcePreview";
import { exportRect, releaseRect, saveRect, shareRect } from "@/src/export";
import { pickSource, releaseSource } from "@/src/media";
import { captureSessionReducer, initialCaptureSession } from "@/src/state/captureSession";
import { creationSessionReducer, initialCreationSession } from "@/src/state/creationSession";
import { exportSessionReducer, initialExportSession } from "@/src/state/exportSession";
import { initialRecordingSession, recordingSessionReducer } from "@/src/state/recordingSession";
import { colors, radii, spacing } from "@/src/theme/tokens";

export default function HomeScreen() {
  const [session, dispatch] = useReducer(creationSessionReducer, initialCreationSession);
  const [captureSession, dispatchCapture] = useReducer(
    captureSessionReducer,
    initialCaptureSession
  );
  const [recordingSession, dispatchRecording] = useReducer(
    recordingSessionReducer,
    initialRecordingSession
  );
  const [exportSession, dispatchExport] = useReducer(exportSessionReducer, initialExportSession);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [saveStatus, setSaveStatus] = useState<{
    busy?: "save" | "share";
    message?: string;
    error?: string;
  }>({});
  const mountedRef = useRef(true);
  const selectedSource = session.source;
  const preparedCapture = captureSession.capture;
  const activeRecording = recordingSession.active;
  const capturedReaction = recordingSession.reaction;
  const exportedRect = exportSession.result;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (selectedSource) {
        releaseSource(selectedSource);
      }
    };
  }, [selectedSource]);

  useEffect(() => {
    return () => {
      if (activeRecording) {
        void cancelRecording(activeRecording);
      }
    };
  }, [activeRecording]);

  useEffect(() => {
    return () => {
      if (capturedReaction) {
        releaseReaction(capturedReaction);
      }
    };
  }, [capturedReaction]);

  useEffect(() => {
    return () => {
      if (exportedRect) {
        releaseRect(exportedRect);
      }
    };
  }, [exportedRect]);

  useEffect(() => {
    return () => {
      if (preparedCapture) {
        stopCapture(preparedCapture);
      }
    };
  }, [preparedCapture]);

  useEffect(() => {
    if (recordingSession.status !== "recording") {
      return;
    }

    const updateElapsed = () => {
      setElapsedMs(Date.now() - recordingSession.active.startedAtMs);
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 100);
    return () => clearInterval(interval);
  }, [recordingSession]);

  async function discardRecording() {
    if (recordingSession.active) {
      await cancelRecording(recordingSession.active).catch(() => undefined);
    }

    dispatchRecording({ type: "recording-reset" });
    dispatchExport({ type: "export-reset" });
    setSaveStatus({});
    setElapsedMs(0);
  }

  async function chooseSource() {
    const previousSource = selectedSource;
    await discardRecording();
    dispatchCapture({ type: "capture-stopped" });
    if (!previousSource) {
      dispatch({ type: "source-selection-started" });
    }

    try {
      const result = await pickSource();
      if (result.status === "cancelled") {
        dispatch(
          previousSource
            ? { type: "source-selected", source: previousSource }
            : { type: "source-selection-cancelled" }
        );
        return;
      }

      dispatch({ type: "source-selected", source: result.source });
    } catch (error) {
      dispatch(
        previousSource
          ? { type: "source-selected", source: previousSource }
          : {
              type: "source-selection-failed",
              message: error instanceof Error ? error.message : "ReactLY could not select that source."
            }
      );
    }
  }

  function beginRecording() {
    if (!preparedCapture || recordingSession.status === "recording" || recordingSession.status === "stopping") {
      return;
    }

    try {
      dispatchExport({ type: "export-reset" });
      const active = startRecording(preparedCapture);
      setElapsedMs(0);
      dispatchRecording({ type: "recording-started", active });
    } catch (error) {
      dispatchRecording({
        type: "recording-failed",
        message: error instanceof Error ? error.message : "ReactLY could not start recording."
      });
    }
  }

  async function createRect() {
    if (!selectedSource || !capturedReaction || exportSession.status === "exporting") {
      return;
    }

    dispatchExport({ type: "export-started" });
    setSaveStatus({});
    try {
      const result = await exportRect(
        { source: selectedSource, reaction: capturedReaction },
        (progress) => {
          if (mountedRef.current) {
            dispatchExport({ type: "export-progressed", progress });
          }
        }
      );
      if (!mountedRef.current) {
        releaseRect(result);
        return;
      }

      dispatchExport({ type: "export-finished", result });
    } catch (error) {
      if (mountedRef.current) {
        dispatchExport({
          type: "export-failed",
          message: error instanceof Error ? error.message : "ReactLY could not export this Rect."
        });
      }
    }
  }

  async function saveExportedRect() {
    if (!exportedRect) {
      return;
    }

    setSaveStatus({ busy: "save" });
    try {
      const fileName = await saveRect(exportedRect);
      setSaveStatus({
        message:
          Platform.OS === "web"
            ? `Download started: ${fileName}`
            : "Rect saved to your media library."
      });
    } catch (error) {
      setSaveStatus({
        error: error instanceof Error ? error.message : "ReactLY could not save this Rect."
      });
    }
  }

  async function shareExportedRect() {
    if (!exportedRect) {
      return;
    }

    setSaveStatus({ busy: "share" });
    try {
      await shareRect(exportedRect);
      setSaveStatus({ message: "System share sheet closed." });
    } catch (error) {
      setSaveStatus({
        error: error instanceof Error ? error.message : "ReactLY could not share this Rect."
      });
    }
  }

  async function finishRecording() {
    if (recordingSession.status !== "recording") {
      return;
    }

    const active = recordingSession.active;
    dispatchRecording({ type: "recording-stop-requested" });
    try {
      const reaction = await stopRecording(active);
      if (!mountedRef.current) {
        releaseReaction(reaction);
        return;
      }

      setElapsedMs(reaction.durationMs);
      dispatchRecording({ type: "recording-captured", reaction });
    } catch (error) {
      if (mountedRef.current) {
        dispatchRecording({
          type: "recording-failed",
          message: error instanceof Error ? error.message : "ReactLY could not stop recording."
        });
      }
    }
  }

  function toggleRecording() {
    if (recordingSession.status === "recording") {
      void finishRecording();
    } else {
      beginRecording();
    }
  }

  function cancelActiveRecording() {
    void discardRecording();
  }

  async function prepareCamera() {
    if (!selectedSource || captureSession.status === "requesting-permission") {
      return;
    }

    dispatchCapture({ type: "permission-requested" });

    try {
      const capture = await prepareCapture();
      if (!mountedRef.current) {
        stopCapture(capture);
        return;
      }

      dispatchCapture({ type: "capture-prepared", capture });
    } catch (error) {
      if (mountedRef.current) {
        dispatchCapture({
          type: "capture-failed",
          message:
            error instanceof Error
              ? error.message
              : "ReactLY could not prepare the camera and microphone."
        });
      }
    }
  }

  function runPrimaryAction() {
    if (!selectedSource) {
      void chooseSource();
      return;
    }

    if (captureSession.status !== "ready") {
      void prepareCamera();
    }
  }

  async function clearSource() {
    await discardRecording();
    dispatchCapture({ type: "capture-stopped" });
    dispatch({ type: "source-cleared" });
  }

  const timerMs = capturedReaction?.durationMs ?? elapsedMs;
  const timerLabel = `${Math.floor(timerMs / 60000)
    .toString()
    .padStart(2, "0")}:${Math.floor((timerMs % 60000) / 1000)
    .toString()
    .padStart(2, "0")}`;
  const recordControlDisabled =
    captureSession.status !== "ready" ||
    recordingSession.status === "stopping" ||
    exportSession.status === "exporting";
  const recordControlLabel =
    recordingSession.status === "recording"
      ? "Stop reaction recording"
      : recordingSession.status === "stopping"
        ? "Finishing reaction recording"
        : capturedReaction
          ? "Record reaction again"
          : "Start reaction recording";

  const primaryLabel = !selectedSource
    ? "CHOOSE SOURCE"
    : captureSession.status === "requesting-permission"
      ? "REQUESTING PERMISSION"
      : captureSession.status === "ready"
        ? "CAMERA + MIC READY"
        : "ENABLE CAMERA + MIC";
  const primaryAccessibilityLabel = !selectedSource
    ? "Choose a source"
    : captureSession.status === "ready"
      ? "Camera and microphone ready"
      : "Enable camera and microphone";
  const primaryDisabled =
    session.status === "selecting-source" ||
    captureSession.status === "requesting-permission" ||
    captureSession.status === "ready";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>ReactLY</Text>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>PROTOTYPE</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.kicker}>REACTION CAMERA, REIMAGINED</Text>
          <Text style={styles.title}>DON&apos;T COMMENT.</Text>
          <Text style={[styles.title, styles.titleAccent]}>REACT.</Text>
          <Text style={styles.copy}>
            Pick anything from your screen. Capture the real face it creates.
            Turn the moment into a Rect.
          </Text>
        </View>

        <View style={styles.recorder}>
          <View style={styles.recorderTop}>
            <Text style={styles.recLabel}>SOURCE VIEW</Text>
            <Text style={recordingSession.status === "recording" ? styles.timerRecording : styles.recLabel}>
              {timerLabel}
            </Text>
          </View>
          <View style={styles.source}>
            {selectedSource ? (
              <SourcePreview source={selectedSource} />
            ) : (
              <>
                <Text style={styles.sourceWord}>
                  {session.status === "selecting-source" ? "OPENING FILES" : "YOUR SOURCE"}
                </Text>
                <Text style={styles.sourceHint}>Local photo or video</Text>
              </>
            )}
          </View>
          <View style={styles.cameraPip}>
            {preparedCapture ? (
              <CameraPreview capture={preparedCapture} />
            ) : (
              <>
                <Text style={styles.pipTitle}>
                  {captureSession.status === "requesting-permission" ? "CONNECTING" : "YOUR REACTION"}
                </Text>
                <Text style={styles.pipHint}>front camera</Text>
              </>
            )}
          </View>
          <View style={styles.controls}>
            <Pressable
              accessibilityLabel="Cancel reaction recording"
              accessibilityRole="button"
              accessibilityState={{ disabled: recordingSession.status !== "recording" }}
              disabled={recordingSession.status !== "recording"}
              onPress={cancelActiveRecording}
              style={({ pressed }) => [
                styles.controlGhost,
                recordingSession.status !== "recording" && styles.controlDisabled,
                pressed && styles.ctaPressed
              ]}
            >
              <Text style={styles.cancelText}>×</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={recordControlLabel}
              accessibilityRole="button"
              accessibilityState={{ disabled: recordControlDisabled }}
              disabled={recordControlDisabled}
              onPress={toggleRecording}
              style={({ pressed }) => [
                styles.recordOuter,
                recordControlDisabled && styles.controlDisabled,
                pressed && styles.ctaPressed
              ]}
            >
              <View
                style={
                  recordingSession.status === "recording"
                    ? styles.recordInnerStopping
                    : styles.recordInner
                }
              />
            </Pressable>
            <View style={styles.controlGhost} />
          </View>
        </View>

        <Pressable
          accessibilityLabel={primaryAccessibilityLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: primaryDisabled }}
          disabled={primaryDisabled}
          onPress={runPrimaryAction}
          style={({ pressed }) => [
            styles.cta,
            primaryDisabled && styles.ctaDisabled,
            pressed && styles.ctaPressed
          ]}
        >
          <Text style={styles.ctaText}>{primaryLabel}</Text>
          <Text style={styles.ctaArrow}>↗</Text>
        </Pressable>

        {selectedSource ? (
          <View style={styles.sourceSummary}>
            <View style={styles.sourceSummaryCopy}>
              <Text numberOfLines={1} style={styles.sourceName}>
                {selectedSource.name}
              </Text>
              <Text style={styles.sourceMeta}>
                {selectedSource.kind.toUpperCase()} · {selectedSource.width}×{selectedSource.height}
              </Text>
            </View>
            <View style={styles.sourceActions}>
              <Pressable
                accessibilityLabel="Replace selected source"
                accessibilityRole="button"
                onPress={() => void chooseSource()}
                style={({ pressed }) => [styles.removeButton, pressed && styles.ctaPressed]}
              >
                <Text style={styles.removeButtonText}>REPLACE</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Remove selected source"
                accessibilityRole="button"
                onPress={() => void clearSource()}
                style={({ pressed }) => [styles.removeButton, pressed && styles.ctaPressed]}
              >
                <Text style={styles.removeButtonText}>REMOVE</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {session.error ? (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {session.error}
          </Text>
        ) : null}

        {captureSession.error ? (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {captureSession.error}
          </Text>
        ) : null}

        {recordingSession.error ? (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {recordingSession.error}
          </Text>
        ) : null}

        {exportSession.error ? (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {exportSession.error}
          </Text>
        ) : null}

        {capturedReaction ? (
          <View accessibilityLabel="Captured reaction ready" style={styles.reactionSummary}>
            <Text style={styles.reactionTitle}>REACTION CAPTURED</Text>
            <Text style={styles.sourceMeta}>
              {capturedReaction.mimeType.toUpperCase()} · {Math.ceil(capturedReaction.sizeBytes / 1024)} KB · {timerLabel}
            </Text>
            <View style={styles.previewSpacing}>
              <ReactionPreview reaction={capturedReaction} />
            </View>
            <Pressable
              accessibilityLabel="Create ReactLY video"
              accessibilityRole="button"
              accessibilityState={{ disabled: exportSession.status === "exporting" }}
              disabled={exportSession.status === "exporting"}
              onPress={() => void createRect()}
              style={({ pressed }) => [
                styles.exportButton,
                exportSession.status === "exporting" && styles.ctaDisabled,
                pressed && styles.ctaPressed
              ]}
            >
              <Text style={styles.exportButtonText}>
                {exportSession.status === "exporting"
                  ? `CREATING RECT ${Math.round(exportSession.progress * 100)}%`
                  : exportedRect
                    ? "CREATE AGAIN"
                    : "CREATE REACTLY VIDEO"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {exportedRect ? (
          <View accessibilityLabel="Exported Rect ready" style={styles.exportSummary}>
            <Text style={styles.reactionTitle}>RECT READY</Text>
            <Text style={styles.sourceMeta}>
              {exportedRect.width}×{exportedRect.height} · {exportedRect.fps} FPS · {Math.ceil(exportedRect.sizeBytes / 1024)} KB
            </Text>
            <View style={styles.previewSpacing}>
              <RectPreview result={exportedRect} />
            </View>
            <Pressable
              accessibilityLabel={
                Platform.OS === "web"
                  ? "Download ReactLY video"
                  : "Save ReactLY video to media library"
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(saveStatus.busy) }}
              disabled={Boolean(saveStatus.busy)}
              onPress={() => void saveExportedRect()}
              style={({ pressed }) => [
                styles.saveButton,
                saveStatus.busy && styles.ctaDisabled,
                pressed && styles.ctaPressed
              ]}
            >
              <Text style={styles.saveButtonText}>
                {saveStatus.busy === "save"
                  ? Platform.OS === "web"
                    ? "STARTING DOWNLOAD"
                    : "SAVING TO PHOTOS"
                  : Platform.OS === "web"
                    ? "DOWNLOAD VIDEO"
                    : "SAVE TO PHOTOS"}
              </Text>
            </Pressable>
            {Platform.OS !== "web" ? (
              <Pressable
                accessibilityLabel="Share ReactLY video"
                accessibilityRole="button"
                accessibilityState={{ disabled: Boolean(saveStatus.busy) }}
                disabled={Boolean(saveStatus.busy)}
                onPress={() => void shareExportedRect()}
                style={({ pressed }) => [
                  styles.shareButton,
                  saveStatus.busy && styles.ctaDisabled,
                  pressed && styles.ctaPressed
                ]}
              >
                <Text style={styles.shareButtonText}>
                  {saveStatus.busy === "share" ? "OPENING SHARE SHEET" : "SHARE VIDEO"}
                </Text>
              </Pressable>
            ) : null}
            {saveStatus.message ? (
              <Text accessibilityLiveRegion="polite" style={styles.saveMessage}>
                {saveStatus.message}
              </Text>
            ) : null}
            {saveStatus.error ? (
              <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                {saveStatus.error}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.note}>
          {selectedSource
            ? captureSession.status === "ready"
              ? capturedReaction
                ? exportedRect
                  ? Platform.OS === "web"
                    ? "Preview your Rect, then download it to this device."
                    : "Preview your Rect, then save it or open the system share sheet."
                  : "Preview the reaction, then create the local ReactLY video."
                : "Press the coral record control when you are ready to react."
              : "Enable camera and microphone to prepare your reaction."
            : "Media stays on this device and is never uploaded."}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  page: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 760,
    paddingHorizontal: spacing.lg,
    paddingBottom: 80
  },
  header: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  brand: { color: colors.text, fontSize: 32, fontWeight: "900", letterSpacing: -2 },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.pill,
    paddingVertical: 9,
    paddingHorizontal: 13
  },
  liveDot: { width: 7, height: 7, borderRadius: 7, backgroundColor: colors.lime },
  liveText: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  hero: { paddingTop: spacing.xl, paddingBottom: spacing.xl },
  kicker: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title: {
    color: colors.text,
    fontSize: 57,
    lineHeight: 55,
    fontWeight: "900",
    letterSpacing: -2.8
  },
  titleAccent: { color: colors.lime },
  copy: {
    color: colors.muted,
    maxWidth: 500,
    fontSize: 16,
    lineHeight: 25,
    marginTop: spacing.lg
  },
  recorder: {
    aspectRatio: 9 / 14,
    maxHeight: 680,
    backgroundColor: colors.panel,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 12,
    overflow: "hidden"
  },
  recorderTop: {
    height: 42,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  recLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  timerRecording: {
    color: colors.coral,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2
  },
  source: {
    flex: 1,
    borderRadius: radii.large,
    backgroundColor: "#0C0C0D",
    borderWidth: 1,
    borderColor: "#222328",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  sourceWord: { color: "#414249", fontSize: 30, fontWeight: "900", letterSpacing: -1 },
  sourceHint: { color: "#5E5F65", fontSize: 11, marginTop: 6 },
  cameraPip: {
    position: "absolute",
    right: 28,
    bottom: 104,
    width: "31%",
    height: "24%",
    borderRadius: radii.medium,
    borderWidth: 2,
    borderColor: colors.lime,
    backgroundColor: "#17131F",
    alignItems: "center",
    justifyContent: "center"
  },
  pipTitle: { color: colors.text, fontSize: 11, fontWeight: "900" },
  pipHint: { color: colors.muted, fontSize: 9, marginTop: 4 },
  controls: {
    height: 82,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 42
  },
  controlGhost: {
    width: 40,
    height: 40,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center"
  },
  controlDisabled: { opacity: 0.3 },
  cancelText: { color: colors.muted, fontSize: 23, lineHeight: 25, fontWeight: "500" },
  recordOuter: {
    width: 60,
    height: 60,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: colors.text,
    padding: 8
  },
  recordInner: { flex: 1, borderRadius: 40, backgroundColor: colors.coral },
  recordInnerStopping: {
    flex: 1,
    margin: 5,
    borderRadius: 5,
    backgroundColor: colors.coral
  },
  cta: {
    minHeight: 64,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  ctaPressed: { opacity: 0.82 },
  ctaDisabled: { opacity: 0.58 },
  ctaText: { color: colors.canvas, fontWeight: "900", letterSpacing: 0.5 },
  ctaArrow: { color: colors.canvas, fontSize: 24, fontWeight: "800" },
  sourceSummary: {
    minHeight: 72,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  sourceSummaryCopy: { flex: 1 },
  sourceActions: { flexDirection: "row", gap: 8 },
  sourceName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  sourceMeta: { color: colors.muted, fontSize: 10, marginTop: 5, letterSpacing: 0.6 },
  removeButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.panelRaised
  },
  removeButtonText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8
  },
  errorText: {
    color: colors.coral,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
    textAlign: "center"
  },
  reactionSummary: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.lime,
    backgroundColor: colors.panel
  },
  reactionTitle: { color: colors.lime, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  previewSpacing: { marginTop: spacing.md },
  exportButton: {
    minHeight: 52,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center"
  },
  exportButtonText: {
    color: colors.canvas,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6
  },
  exportSummary: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.violet,
    backgroundColor: colors.panel
  },
  saveButton: {
    minHeight: 52,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.lime,
    alignItems: "center",
    justifyContent: "center"
  },
  saveButtonText: {
    color: colors.lime,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6
  },
  shareButton: {
    minHeight: 52,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.violet,
    alignItems: "center",
    justifyContent: "center"
  },
  shareButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6
  },
  saveMessage: {
    color: colors.text,
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.sm,
    textAlign: "center"
  },
  note: {
    color: "#63645F",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.md
  }
});
