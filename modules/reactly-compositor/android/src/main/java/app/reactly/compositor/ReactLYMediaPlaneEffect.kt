package app.reactly.compositor

import android.content.Context
import android.opengl.GLES20
import androidx.media3.common.VideoFrameProcessingException
import androidx.media3.common.util.GlProgram
import androidx.media3.common.util.GlUtil
import androidx.media3.common.util.Size
import androidx.media3.effect.BaseGlShaderProgram
import androidx.media3.effect.GlEffect

internal enum class MediaPlane {
  SOURCE,
  REACTION,
}

/** Applies cover-crop and the planned rounded card edge before Media3 places a media plane. */
internal class ReactLYMediaPlaneEffect(
  private val plan: ReactLYExportPlan,
  private val plane: MediaPlane,
) : GlEffect {
  override fun toGlShaderProgram(context: Context, useHdr: Boolean): BaseGlShaderProgram {
    require(!useHdr) { "ReactLY Phase 1 export supports SDR media only." }
    return ReactLYMediaPlaneShaderProgram(plan, plane)
  }
}

private class ReactLYMediaPlaneShaderProgram(
  private val plan: ReactLYExportPlan,
  private val plane: MediaPlane,
) : BaseGlShaderProgram(false, 1) {
  private val glProgram: GlProgram
  private var inputWidth = 1
  private var inputHeight = 1

  init {
    try {
      glProgram = GlProgram(VERTEX_SHADER, FRAGMENT_SHADER)
      glProgram.setBufferAttribute(
        "aFramePosition",
        GlUtil.getNormalizedCoordinateBounds(),
        GlUtil.HOMOGENEOUS_COORDINATE_VECTOR_SIZE,
      )
    } catch (error: GlUtil.GlException) {
      throw VideoFrameProcessingException(error)
    }
  }

  override fun configure(inputWidth: Int, inputHeight: Int): Size {
    this.inputWidth = inputWidth
    this.inputHeight = inputHeight
    // Overlay scales are fractions of the export canvas. Normalize each texture
    // to that canvas so Media3's intrinsic texture-size scaling cannot change
    // the planned rectangles for portrait videos or landscape source images.
    return Size(plan.width, plan.height)
  }

  override fun drawFrame(inputTexId: Int, presentationTimeUs: Long) {
    val frame = plan.frameAt(presentationTimeUs)
    val rect = if (plane == MediaPlane.SOURCE) frame.sourceRect else frame.reactionRect
    val radius = if (plane == MediaPlane.SOURCE) frame.sourceRadius else frame.reactionRadius
    val outlineWidth = if (radius > 0f) (plan.width * 0.006f).coerceAtLeast(2f) else 0f

    try {
      glProgram.use()
      glProgram.setSamplerTexIdUniform("uTexSampler", inputTexId, 0)
      glProgram.setFloatsUniform("uInputSize", floatArrayOf(inputWidth.toFloat(), inputHeight.toFloat()))
      glProgram.setFloatsUniform("uPlaneSize", floatArrayOf(rect.width, rect.height))
      glProgram.setFloatUniform("uCornerRadius", radius.coerceAtMost(minOf(rect.width, rect.height) / 2f))
      glProgram.setFloatUniform("uOutlineWidth", outlineWidth)
      glProgram.setFloatsUniform("uOutlineColor", floatArrayOf(0.78f, 1f, 0.21f, 1f))
      glProgram.bindAttributesAndUniforms()
      GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
      GlUtil.checkGlError()
    } catch (error: GlUtil.GlException) {
      throw VideoFrameProcessingException(error, presentationTimeUs)
    }
  }

  override fun release() {
    super.release()
    try {
      glProgram.delete()
    } catch (error: GlUtil.GlException) {
      throw VideoFrameProcessingException(error)
    }
  }

  companion object {
    private const val VERTEX_SHADER = """
      attribute vec4 aFramePosition;
      varying vec2 vTextureCoordinate;

      void main() {
        gl_Position = aFramePosition;
        vTextureCoordinate = aFramePosition.xy * 0.5 + 0.5;
      }
    """

    private const val FRAGMENT_SHADER = """
      precision mediump float;

      uniform sampler2D uTexSampler;
      uniform vec2 uInputSize;
      uniform vec2 uPlaneSize;
      uniform float uCornerRadius;
      uniform float uOutlineWidth;
      uniform vec4 uOutlineColor;
      varying vec2 vTextureCoordinate;

      float roundedRectDistance(vec2 point, vec2 size, float radius) {
        vec2 halfSize = size * 0.5;
        vec2 q = abs(point - halfSize) - (halfSize - vec2(radius));
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
      }

      void main() {
        float inputAspect = uInputSize.x / uInputSize.y;
        float planeAspect = uPlaneSize.x / uPlaneSize.y;
        vec2 sampleCoordinate = vTextureCoordinate;

        if (inputAspect > planeAspect) {
          float visibleWidth = planeAspect / inputAspect;
          sampleCoordinate.x = 0.5 + (sampleCoordinate.x - 0.5) * visibleWidth;
        } else {
          float visibleHeight = inputAspect / planeAspect;
          sampleCoordinate.y = 0.5 + (sampleCoordinate.y - 0.5) * visibleHeight;
        }

        vec4 mediaColor = texture2D(uTexSampler, sampleCoordinate);
        float distanceToEdge = roundedRectDistance(
          vTextureCoordinate * uPlaneSize,
          uPlaneSize,
          uCornerRadius
        );
        float insideAlpha = 1.0 - smoothstep(-1.25, 1.25, distanceToEdge);
        float outlineAlpha = step(0.5, uOutlineWidth)
          * smoothstep(-uOutlineWidth - 1.0, -uOutlineWidth + 1.0, distanceToEdge)
          * (1.0 - smoothstep(-1.0, 1.0, distanceToEdge));

        vec4 result = mix(mediaColor, uOutlineColor, outlineAlpha);
        result.a *= insideAlpha;
        gl_FragColor = result;
      }
    """
  }
}
