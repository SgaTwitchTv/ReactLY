import { Image, StyleSheet, View } from "react-native";

import type { SourceMedia } from "../media/types";

interface SourcePreviewProps {
  source: SourceMedia;
}

export function SourcePreview({ source }: SourcePreviewProps) {
  if (source.kind === "image") {
    return <Image accessibilityLabel={`Selected source ${source.name}`} source={{ uri: source.uri }} style={styles.media} />;
  }

  return (
    <View style={styles.media}>
      <video
        aria-label={`Selected source ${source.name}`}
        controls
        loop
        muted
        playsInline
        src={source.uri}
        style={styles.video}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  media: { width: "100%", height: "100%" },
  video: { width: "100%", height: "100%", objectFit: "cover" }
});
