import { useVideoPlayer, VideoView } from "expo-video";
import { StyleSheet, View } from "react-native";

import type { RectExportResult } from "../export/types";
interface RectPreviewProps {
  result: RectExportResult;
}

export function RectPreview({ result }: RectPreviewProps) {
  const player = useVideoPlayer(result.uri);

  return (
    <View accessibilityLabel="Exported ReactLY video preview" style={styles.shell}>
      <VideoView
        contentFit="contain"
        fullscreenOptions={{ enable: true }}
        nativeControls
        player={player}
        style={styles.video}
        surfaceType="textureView"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { height: 480, overflow: "hidden", borderRadius: 18, backgroundColor: "#070707" },
  video: { width: "100%", height: 480 }
});
