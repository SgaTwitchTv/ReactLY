package app.reactly.compositor

import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Effects
import androidx.media3.transformer.Transformer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Coroutine
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

@UnstableApi
class ReactLYCompositorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReactLYCompositor")

    AsyncFunction("exportAsync") Coroutine { rawPlan: Map<String, Any?> ->
      export(ReactLYExportPlanParser.parse(rawPlan))
    }
  }

  private suspend fun export(plan: ReactLYExportPlan): Map<String, Any> {
    val context = appContext.reactContext
      ?: throw IllegalStateException("ReactLY cannot export without an Android application context.")
    val output = File(context.cacheDir, "reactly-${System.currentTimeMillis()}.mp4")
    val brandImage = File(context.cacheDir, "reactly-brand-${System.currentTimeMillis()}.png")
    ReactLYBrandRenderer.render(plan, brandImage)

    return suspendCancellableCoroutine { continuation ->
      val listener = object : Transformer.Listener {
        override fun onCompleted(composition: Composition, exportResult: ExportResult) {
          brandImage.delete()
          if (continuation.isActive) {
            continuation.resume(
              mapOf(
                "uri" to Uri.fromFile(output).toString(),
                "mimeType" to MimeTypes.VIDEO_MP4,
                "sizeBytes" to output.length(),
              )
            )
          }
        }

        override fun onError(
          composition: Composition,
          exportResult: ExportResult,
          exportException: ExportException,
        ) {
          brandImage.delete()
          output.delete()
          if (continuation.isActive) continuation.resumeWithException(exportException)
        }
      }

      val transformer = Transformer.Builder(context)
        .setAudioMimeType(MimeTypes.AUDIO_AAC)
        .setVideoMimeType(MimeTypes.VIDEO_H264)
        .setPortraitEncodingEnabled(true)
        .addListener(listener)
        .build()

      continuation.invokeOnCancellation {
        context.mainExecutor.execute {
          transformer.cancel()
          brandImage.delete()
          output.delete()
        }
      }

      try {
        transformer.start(buildComposition(plan, brandImage), output.absolutePath)
      } catch (error: Throwable) {
        brandImage.delete()
        output.delete()
        if (continuation.isActive) continuation.resumeWithException(error)
      }
    }
  }

  private fun buildComposition(plan: ReactLYExportPlan, brandImage: File): Composition {
    val brand = EditedMediaItem.Builder(
      MediaItem.Builder()
        .setUri(Uri.fromFile(brandImage))
        .setImageDurationMs(plan.durationMs)
        .build()
    )
      .setRemoveAudio(true)
      .setFrameRate(plan.fps)
      .build()
    val source = sourceItem(plan)
    val reaction = EditedMediaItem.Builder(
      MediaItem.Builder()
        .setUri(plan.reaction.uri)
        .setClippingConfiguration(
          MediaItem.ClippingConfiguration.Builder().setEndPositionMs(plan.durationMs).build()
        )
        .build()
    )
      .setRemoveAudio(!plan.reaction.includeAudio)
      .setEffects(
        Effects(emptyList(), listOf(ReactLYMediaPlaneEffect(plan, MediaPlane.REACTION)))
      )
      .build()

    val brandSequence = videoSequence(brand, false)
    val sourceBack = videoSequence(source, plan.source.loop)
    val reactionSequence = EditedMediaItemSequence.Builder(setOf(C.TRACK_TYPE_AUDIO, C.TRACK_TYPE_VIDEO))
      .addItem(reaction)
      .build()
    val sourceFront = videoSequence(source, plan.source.loop)

    // Media3 draws the first registered sequence on top (unlike canvas draw order).
    // Keep these indices in sync with ReactLYVideoCompositorSettings.
    return Composition.Builder(listOf(sourceFront, reactionSequence, sourceBack, brandSequence))
      .setVideoCompositorSettings(ReactLYVideoCompositorSettings(plan))
      .build()
  }

  private fun sourceItem(plan: ReactLYExportPlan): EditedMediaItem {
    val mediaItem = MediaItem.Builder()
      .setUri(plan.source.uri)
      .apply {
        if (plan.source.kind == "image") setImageDurationMs(plan.durationMs)
      }
      .build()

    return EditedMediaItem.Builder(mediaItem)
      .setRemoveAudio(true)
      .setFrameRate(plan.fps)
      .setEffects(
        Effects(emptyList(), listOf(ReactLYMediaPlaneEffect(plan, MediaPlane.SOURCE)))
      )
      .build()
  }

  private fun videoSequence(item: EditedMediaItem, looping: Boolean): EditedMediaItemSequence =
    EditedMediaItemSequence.Builder(setOf(C.TRACK_TYPE_VIDEO))
      .addItem(item)
      .setIsLooping(looping)
      .build()
}
