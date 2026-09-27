import { useEffect, useRef } from "react";

import type { PreparedCapture } from "../capture/types";

interface CameraPreviewProps {
  capture: PreparedCapture;
}

export function CameraPreview({ capture }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const stream = capture.preview;
    if (!video || !(stream instanceof MediaStream)) {
      return;
    }

    video.srcObject = stream;
    void video.play().catch(() => {
      // The muted preview may wait for the next user gesture on stricter browsers.
    });

    return () => {
      video.srcObject = null;
    };
  }, [capture]);

  return (
    <video
      ref={videoRef}
      aria-label="Live front camera preview"
      autoPlay
      muted
      playsInline
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: "scaleX(-1)"
      }}
    />
  );
}
