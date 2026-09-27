package app.reactly.compositor

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import java.io.File
import java.io.FileOutputStream

/** Produces the local brand plane that moving media reveals during the role swap. */
internal object ReactLYBrandRenderer {
  fun render(plan: ReactLYExportPlan, output: File) {
    val bitmap = Bitmap.createBitmap(plan.width, plan.height, Bitmap.Config.ARGB_8888)
    try {
      val canvas = Canvas(bitmap)
      canvas.drawColor(parseColor(plan.brand.backgroundColor, "backgroundColor"))

      val centerX = plan.width / 2f
      val centerY = plan.height / 2f
      val watermarkPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = parseColor(plan.brand.accentColor, "accentColor")
        alpha = 72
        textAlign = Paint.Align.CENTER
        textSize = plan.width * 0.13f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        letterSpacing = 0.03f
      }
      val taglinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        alpha = 88
        textAlign = Paint.Align.CENTER
        textSize = plan.width * 0.027f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        letterSpacing = 0.12f
      }

      canvas.drawText(plan.brand.watermark, centerX, centerY, watermarkPaint)
      canvas.drawText(plan.brand.tagline, centerX, centerY + plan.height * 0.045f, taglinePaint)

      FileOutputStream(output).use { stream ->
        check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)) {
          "ReactLY could not encode its temporary brand layer."
        }
      }
    } finally {
      bitmap.recycle()
    }
  }

  private fun parseColor(value: String, label: String): Int = try {
    Color.parseColor(value)
  } catch (error: IllegalArgumentException) {
    throw IllegalArgumentException("Invalid ReactLY brand $label: $value", error)
  }
}
