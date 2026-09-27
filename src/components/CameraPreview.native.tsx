import { CameraView, type CameraMountError } from "expo-camera";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { isNativeCapturePreview } from "../capture/nativeCapture";
import type { PreparedCapture } from "../capture/types";
import { colors } from "../theme/tokens";

interface CameraPreviewProps {
  capture: PreparedCapture;
}

export function CameraPreview({ capture }: CameraPreviewProps) {
  const [mountError, setMountError] = useState<string | null>(null);
  const preview = capture.preview;

  useEffect(() => {
    return () => {
      if (isNativeCapturePreview(preview)) {
        preview.attachCamera(null);
      }
    };
  }, [preview]);

  if (!isNativeCapturePreview(preview) || !preview.isActive()) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.errorLabel}>CAMERA UNAVAILABLE</Text>
      </View>
    );
  }
  const nativePreview = preview;

  function handleMountError(error: CameraMountError) {
    nativePreview.markUnavailable();
    setMountError(error.message);
  }

  if (mountError) {
    return (
      <View accessibilityLabel={`Camera preview error: ${mountError}`} style={styles.placeholder}>
        <Text style={styles.errorLabel}>CAMERA ERROR</Text>
      </View>
    );
  }

  return (
    <View accessibilityLabel="Live front camera preview" style={styles.previewShell}>
      <CameraView
        facing="front"
        mirror
        mode="video"
        onCameraReady={() => {
          nativePreview.markReady();
        }}
        onMountError={handleMountError}
        ref={(camera) => {
          nativePreview.attachCamera(camera);
        }}
        style={styles.camera}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  previewShell: { width: "100%", height: "100%", overflow: "hidden" },
  camera: { width: "100%", height: "100%" },
  placeholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  errorLabel: { color: colors.coral, fontSize: 9, fontWeight: "900" }
});
