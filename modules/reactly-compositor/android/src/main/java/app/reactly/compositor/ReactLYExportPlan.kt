package app.reactly.compositor

internal data class ExportRect(
  val x: Float,
  val y: Float,
  val width: Float,
  val height: Float,
)

internal data class ExportFrame(
  val timeMs: Long,
  val sourceRect: ExportRect,
  val reactionRect: ExportRect,
  val sourceRadius: Float,
  val reactionRadius: Float,
  val brandOpacity: Float,
  val sourceInForeground: Boolean,
)

internal data class ExportBrand(
  val backgroundColor: String,
  val accentColor: String,
  val watermark: String,
  val tagline: String,
)

internal data class ExportAsset(
  val uri: String,
  val kind: String? = null,
  val loop: Boolean = false,
  val includeAudio: Boolean = false,
  val mirrored: Boolean = false,
)

internal data class ReactLYExportPlan(
  val width: Int,
  val height: Int,
  val fps: Int,
  val durationMs: Long,
  val source: ExportAsset,
  val reaction: ExportAsset,
  val brand: ExportBrand,
  val frames: List<ExportFrame>,
) {
  fun frameAt(presentationTimeUs: Long): ExportFrame {
    val timeMs = presentationTimeUs / 1_000L
    var low = 0
    var high = frames.lastIndex

    while (low <= high) {
      val middle = (low + high) ushr 1
      if (frames[middle].timeMs <= timeMs) low = middle + 1 else high = middle - 1
    }

    return frames[high.coerceAtLeast(0)]
  }
}

internal object ReactLYExportPlanParser {
  fun parse(value: Map<String, Any?>): ReactLYExportPlan {
    require(number(value, "version").toInt() == 1) { "Unsupported ReactLY export plan version." }
    val width = positiveInt(value, "width")
    val height = positiveInt(value, "height")
    val fps = positiveInt(value, "fps")
    val durationMs = positiveLong(value, "durationMs")
    val frames = list(value, "frames").mapIndexed { index, frameValue ->
      val frame = map(frameValue, "frames[$index]")
      ExportFrame(
        timeMs = nonNegativeLong(frame, "timeMs"),
        sourceRect = rect(frame, "sourceRect"),
        reactionRect = rect(frame, "reactionRect"),
        sourceRadius = nonNegativeFloat(frame, "sourceRadius"),
        reactionRadius = nonNegativeFloat(frame, "reactionRadius"),
        brandOpacity = unitFloat(frame, "brandOpacity"),
        sourceInForeground = string(frame, "foreground") == "source",
      )
    }

    require(frames.isNotEmpty()) { "The ReactLY export plan has no frames." }
    require(frames.zipWithNext().all { (left, right) -> left.timeMs <= right.timeMs }) {
      "ReactLY export frames must be ordered by time."
    }

    val sourceValue = map(value["source"], "source")
    val reactionValue = map(value["reaction"], "reaction")
    val brandValue = map(value["brand"], "brand")
    val sourceKind = string(sourceValue, "kind")
    require(sourceKind == "image" || sourceKind == "video") { "Unsupported source kind: $sourceKind" }

    return ReactLYExportPlan(
      width = width,
      height = height,
      fps = fps,
      durationMs = durationMs,
      source = ExportAsset(
        uri = string(sourceValue, "uri"),
        kind = sourceKind,
        loop = boolean(sourceValue, "loop"),
      ),
      reaction = ExportAsset(
        uri = string(reactionValue, "uri"),
        includeAudio = boolean(reactionValue, "includeAudio"),
        mirrored = boolean(reactionValue, "mirrored"),
      ),
      brand = ExportBrand(
        backgroundColor = string(brandValue, "backgroundColor"),
        accentColor = string(brandValue, "accentColor"),
        watermark = string(brandValue, "watermark"),
        tagline = string(brandValue, "tagline"),
      ),
      frames = frames,
    )
  }

  private fun rect(parent: Map<String, Any?>, key: String): ExportRect {
    val value = map(parent[key], key)
    val rect = ExportRect(
      x = number(value, "x").toFloat(),
      y = number(value, "y").toFloat(),
      width = number(value, "width").toFloat(),
      height = number(value, "height").toFloat(),
    )
    require(rect.width > 0f && rect.height > 0f) { "$key must have a positive size." }
    return rect
  }

  private fun map(value: Any?, label: String): Map<String, Any?> =
    (value as? Map<*, *>)?.entries?.associate { (key, entryValue) -> key.toString() to entryValue }
      ?: throw IllegalArgumentException("$label must be an object.")

  private fun list(parent: Map<String, Any?>, key: String): List<Any?> =
    parent[key] as? List<*> ?: throw IllegalArgumentException("$key must be an array.")

  private fun number(parent: Map<String, Any?>, key: String): Number =
    parent[key] as? Number ?: throw IllegalArgumentException("$key must be a number.")

  private fun string(parent: Map<String, Any?>, key: String): String =
    parent[key] as? String ?: throw IllegalArgumentException("$key must be a string.")

  private fun boolean(parent: Map<String, Any?>, key: String): Boolean =
    parent[key] as? Boolean ?: throw IllegalArgumentException("$key must be a boolean.")

  private fun positiveInt(parent: Map<String, Any?>, key: String): Int =
    number(parent, key).toInt().also { require(it > 0) { "$key must be positive." } }

  private fun positiveLong(parent: Map<String, Any?>, key: String): Long =
    number(parent, key).toLong().also { require(it > 0L) { "$key must be positive." } }

  private fun nonNegativeLong(parent: Map<String, Any?>, key: String): Long =
    number(parent, key).toLong().also { require(it >= 0L) { "$key cannot be negative." } }

  private fun nonNegativeFloat(parent: Map<String, Any?>, key: String): Float =
    number(parent, key).toFloat().also {
      require(it.isFinite() && it >= 0f) { "$key must be finite and non-negative." }
    }

  private fun unitFloat(parent: Map<String, Any?>, key: String): Float =
    number(parent, key).toFloat().also {
      require(it.isFinite() && it in 0f..1f) { "$key must be between zero and one." }
    }
}
