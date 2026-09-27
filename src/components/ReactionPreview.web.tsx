import type { SyntheticEvent } from "react";

import type { CapturedReaction } from "../capture/types";

interface ReactionPreviewProps {
  reaction: CapturedReaction;
}

export function ReactionPreview({ reaction }: ReactionPreviewProps) {
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
      aria-label="Raw captured reaction preview"
      controls
      onLoadedMetadata={normalizeDuration}
      playsInline
      preload="metadata"
      src={reaction.uri}
      style={{ width: "100%", maxHeight: 320, borderRadius: 18, backgroundColor: "#070707" }}
    />
  );
}
