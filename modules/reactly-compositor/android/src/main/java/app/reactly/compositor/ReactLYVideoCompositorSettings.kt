package app.reactly.compositor

import androidx.media3.common.OverlaySettings
import androidx.media3.common.VideoCompositorSettings
import androidx.media3.common.util.Size
import androidx.media3.effect.StaticOverlaySettings

/** Maps ReactLY's deterministic output-space frame plan into Media3 overlay coordinates. */
internal class ReactLYVideoCompositorSettings(
  private val plan: ReactLYExportPlan,
) : VideoCompositorSettings {
  override fun getOutputSize(inputSizes: List<Size>): Size = Size(plan.width, plan.height)

  override fun getOverlaySettings(inputId: Int, presentationTimeUs: Long): OverlaySettings {
    val frame = plan.frameAt(presentationTimeUs)
    val (rect, alpha, mirrored) = when (inputId) {
      BRAND_INPUT -> Triple(
        ExportRect(0f, 0f, plan.width.toFloat(), plan.height.toFloat()),
        frame.brandOpacity,
        false,
      )
      SOURCE_BACK_INPUT -> Triple(frame.sourceRect, if (frame.sourceInForeground) 0f else 1f, false)
      REACTION_INPUT -> Triple(frame.reactionRect, 1f, plan.reaction.mirrored)
      SOURCE_FRONT_INPUT -> Triple(frame.sourceRect, if (frame.sourceInForeground) 1f else 0f, false)
      else -> throw IllegalArgumentException("Unexpected ReactLY compositor input: $inputId")
    }

    val scaleX = rect.width / plan.width.toFloat() * if (mirrored) -1f else 1f
    val scaleY = rect.height / plan.height.toFloat()
    val centerX = ((rect.x + rect.width / 2f) / plan.width.toFloat()) * 2f - 1f
    val centerY = 1f - ((rect.y + rect.height / 2f) / plan.height.toFloat()) * 2f

    return StaticOverlaySettings.Builder()
      .setScale(scaleX, scaleY)
      .setOverlayFrameAnchor(0f, 0f)
      .setBackgroundFrameAnchor(centerX, centerY)
      .setAlphaScale(alpha)
      .build()
  }

  companion object {
    // Media3 input order is foreground to background.
    const val SOURCE_FRONT_INPUT = 0
    const val REACTION_INPUT = 1
    const val SOURCE_BACK_INPUT = 2
    const val BRAND_INPUT = 3
  }
}
