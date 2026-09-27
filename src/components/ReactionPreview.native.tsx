import { useVideoPlayer, VideoView } from "expo-video";
import { StyleSheet, View } from "react-native";

import type { CapturedReaction } from "../capture/types";

interface ReactionPreviewProps {
  reaction: CapturedReaction;
}

export function ReactionPreview({ reaction }: ReactionPreviewProps) {
  const player = useVideoPlayer(reaction.uri);

  return (
    <View accessibilityLabel="Raw captured reaction preview" style={styles.shell}>
      <VideoView
        contentFit="cover"
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
  shell: { minHeight: 240, overflow: "hidden", borderRadius: 18 },
  video: { width: "100%", height: 240 }
});
