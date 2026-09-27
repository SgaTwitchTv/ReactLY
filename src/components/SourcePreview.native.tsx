import { Image, StyleSheet, Text, View } from "react-native";

import type { SourceMedia } from "../media/types";
import { colors } from "../theme/tokens";

interface SourcePreviewProps {
  source: SourceMedia;
}

export function SourcePreview({ source }: SourcePreviewProps) {
  if (source.kind === "image") {
    return <Image accessibilityLabel={`Selected source ${source.name}`} source={{ uri: source.uri }} style={styles.media} />;
  }

  return (
    <View style={[styles.media, styles.placeholder]}>
      <Text style={styles.placeholderText}>VIDEO SOURCE READY</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  media: { width: "100%", height: "100%" },
  placeholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { color: colors.muted, fontSize: 11, fontWeight: "800" }
});
