import type { SyntheticEvent } from "react";

import type { RectExportResult } from "../export/types";

interface RectPreviewProps {
  result: RectExportResult;
}

export function RectPreview({ result }: RectPreviewProps) {
  function normalizeDuration(event: SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    if (Number.isFinite(video.duration)) {
      return;
    }

    video.currentTime = Number.MAX_SAFE_INTEGER;
    video.ontimeupdate = () => {
      video.ontimeupdate = null;
      video.currentTime = 0;
    };
  }

  return (
    <video
      aria-label="Exported ReactLY video preview"
      controls
      onLoadedMetadata={normalizeDuration}
      playsInline
      preload="metadata"
      src={result.uri}
      style={{ width: "100%", maxHeight: 560, borderRadius: 18, backgroundColor: "#070707" }}
    />
  );
}
