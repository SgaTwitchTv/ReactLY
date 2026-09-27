import { layerOrderAt } from "../composition/layerOrder";
import { layoutAt } from "../composition/timeline";
import type { Rect } from "../composition/types";
import { RectExportError } from "./errors";
import type { ExportProgressListener, RectExportInput, RectExportResult } from "./types";

const EXPORT_WIDTH = 720;
const EXPORT_HEIGHT = 1280;
const EXPORT_FPS = 30;
const LIME = "#C7FF35";

type DrawableMedia = HTMLImageElement | HTMLVideoElement;

interface LoadedMedia {
  element: DrawableMedia;
  width: number;
  height: number;
}

function selectExportMimeType(): string | undefined {
  return ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(
    (mimeType) => MediaRecorder.isTypeSupported(mimeType)
  );
}

function loadImage(uri: string): Promise<LoadedMedia> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({ element: image, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new RectExportError("ReactLY could not load the source image."));
    image.src = uri;
  });
}

function loadVideo(uri: string, loop: boolean): Promise<LoadedMedia> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.playsInline = true;
    video.loop = loop;
    video.onloadedmetadata = () =>
      resolve({ element: video, width: video.videoWidth, height: video.videoHeight });
    video.onerror = () => reject(new RectExportError("ReactLY could not load video for export."));
    video.src = uri;
    video.load();
  });
}

function roundedRectPath(context: CanvasRenderingContext2D, rect: Rect, radius: number): void {
  const safeRadius = Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2));
  context.beginPath();
  context.moveTo(rect.x + safeRadius, rect.y);
  context.lineTo(rect.x + rect.width - safeRadius, rect.y);
  context.quadraticCurveTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + safeRadius);
  context.lineTo(rect.x + rect.width, rect.y + rect.height - safeRadius);
  context.quadraticCurveTo(
    rect.x + rect.width,
    rect.y + rect.height,
    rect.x + rect.width - safeRadius,
    rect.y + rect.height
  );
  context.lineTo(rect.x + safeRadius, rect.y + rect.height);
  context.quadraticCurveTo(rect.x, rect.y + rect.height, rect.x, rect.y + rect.height - safeRadius);
  context.lineTo(rect.x, rect.y + safeRadius);
  context.quadraticCurveTo(rect.x, rect.y, rect.x + safeRadius, rect.y);
  context.closePath();
}

function drawCover(
  context: CanvasRenderingContext2D,
  media: LoadedMedia,
  rect: Rect,
  radius: number,
  mirrored: boolean,
  outlined: boolean
): void {
  const sourceRatio = media.width / media.height;
  const targetRatio = rect.width / rect.height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = media.width;
  let sourceHeight = media.height;

  if (sourceRatio > targetRatio) {
    sourceWidth = media.height * targetRatio;
    sourceX = (media.width - sourceWidth) / 2;
  } else {
    sourceHeight = media.width / targetRatio;
    sourceY = (media.height - sourceHeight) / 2;
  }

  context.save();
  roundedRectPath(context, rect, radius);
  context.clip();
  if (mirrored) {
    context.translate(rect.x * 2 + rect.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(
    media.element,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    rect.x,
    rect.y,
    rect.width,
    rect.height
  );
  context.restore();

  if (outlined) {
    context.save();
    roundedRectPath(context, rect, radius);
    context.strokeStyle = LIME;
    context.lineWidth = Math.max(3, EXPORT_WIDTH * 0.004);
    context.stroke();
    context.restore();
  }
}

function drawBrand(context: CanvasRenderingContext2D, opacity: number): void {
  context.save();
  context.globalAlpha = opacity;
  context.fillStyle = "#070707";
  context.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  context.textAlign = "center";
  context.fillStyle = "rgba(246,247,242,0.24)";
  context.font = "900 68px sans-serif";
  context.fillText("ReactLY", EXPORT_WIDTH / 2, EXPORT_HEIGHT / 2 - 8);
  context.fillStyle = "rgba(199,255,53,0.34)";
  context.font = "800 20px sans-serif";
  context.fillText("DON'T COMMENT. REACT.", EXPORT_WIDTH / 2, EXPORT_HEIGHT / 2 + 34);
  context.restore();
}

function drawFrame(
  context: CanvasRenderingContext2D,
  timeMs: number,
  source: LoadedMedia,
  reaction: LoadedMedia
): void {
  const layout = layoutAt(timeMs, { width: EXPORT_WIDTH, height: EXPORT_HEIGHT });
  context.fillStyle = "#070707";
  context.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  drawBrand(context, layout.brandOpacity);

  const sourceOutlined = layout.phase !== "source-first";
  const cameraOutlined = layout.phase !== "reaction-first";
  const drawSource = () =>
    drawCover(
      context,
      source,
      layout.sourceRect,
      layout.sourceRadius,
      false,
      sourceOutlined
    );
  const drawReaction = () =>
    drawCover(
      context,
      reaction,
      layout.cameraRect,
      layout.cameraRadius,
      true,
      cameraOutlined
    );

  for (const layer of layerOrderAt(timeMs)) {
    if (layer === "source") {
      drawSource();
    } else {
      drawReaction();
    }
  }
}

function recorderCompletion(recorder: MediaRecorder, chunks: Blob[]): Promise<Blob> {
  return new Promise((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    recorder.onerror = () => reject(new RectExportError("The browser could not encode the Rect."));
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
  });
}

export async function exportRect(
  input: RectExportInput,
  onProgress?: ExportProgressListener
): Promise<RectExportResult> {
  if (typeof MediaRecorder === "undefined") {
    throw new RectExportError("This browser does not support local Rect export.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context || typeof canvas.captureStream !== "function") {
    throw new RectExportError("This browser does not support canvas video export.");
  }

  const [source, reaction] = await Promise.all([
    input.source.kind === "image"
      ? loadImage(input.source.uri)
      : loadVideo(input.source.uri, true),
    loadVideo(input.reaction.uri, false)
  ]);
  const reactionVideo = reaction.element as HTMLVideoElement;
  const sourceVideo = input.source.kind === "video" ? (source.element as HTMLVideoElement) : null;
  const audioContext = new AudioContext();
  const audioDestination = audioContext.createMediaStreamDestination();
  const reactionAudio = audioContext.createMediaElementSource(reactionVideo);
  reactionAudio.connect(audioDestination);
  await audioContext.resume();

  const outputStream = canvas.captureStream(EXPORT_FPS);
  audioDestination.stream.getAudioTracks().forEach((track) => outputStream.addTrack(track));
  const mimeType = selectExportMimeType();
  const recorder = new MediaRecorder(outputStream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  const completion = recorderCompletion(recorder, chunks);
  reactionVideo.currentTime = 0;
  if (sourceVideo) {
    sourceVideo.currentTime = 0;
    sourceVideo.muted = true;
  }

  try {
    await Promise.all([reactionVideo.play(), sourceVideo?.play() ?? Promise.resolve()]);
    const startTime = performance.now();
    recorder.start(250);
    onProgress?.(0);

    await new Promise<void>((resolve) => {
      const render = (now: number) => {
        const elapsedMs = Math.min(input.reaction.durationMs, now - startTime);
        drawFrame(context, elapsedMs, source, reaction);
        onProgress?.(Math.min(1, elapsedMs / input.reaction.durationMs));

        if (elapsedMs >= input.reaction.durationMs || reactionVideo.ended) {
          resolve();
          return;
        }

        requestAnimationFrame(render);
      };
      requestAnimationFrame(render);
    });

    recorder.stop();
    const blob = await completion;
    if (blob.size === 0) {
      throw new RectExportError("The exported Rect was empty.");
    }

    onProgress?.(1);
    return {
      uri: URL.createObjectURL(blob),
      mimeType: blob.type || "video/webm",
      sizeBytes: blob.size,
      durationMs: input.reaction.durationMs,
      width: EXPORT_WIDTH,
      height: EXPORT_HEIGHT,
      fps: EXPORT_FPS
    };
  } finally {
    reactionVideo.pause();
    sourceVideo?.pause();
    outputStream.getTracks().forEach((track) => track.stop());
    await audioContext.close();
  }
}

export function releaseRect(result: RectExportResult): void {
  URL.revokeObjectURL(result.uri);
}
