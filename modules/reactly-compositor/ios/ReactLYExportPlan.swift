import CoreGraphics
import Foundation

struct ReactLYExportFrame {
  let timeMs: Double
  let sourceRect: CGRect
  let reactionRect: CGRect
  let sourceRadius: CGFloat
  let reactionRadius: CGFloat
  let brandOpacity: CGFloat
  let sourceInForeground: Bool
}

struct ReactLYExportAsset {
  let url: URL
  let kind: String?
  let loop: Bool
  let includeAudio: Bool
  let mirrored: Bool
}

struct ReactLYExportBrand {
  let backgroundColor: String
  let accentColor: String
  let watermark: String
  let tagline: String
}

struct ReactLYExportPlan {
  let width: Int
  let height: Int
  let fps: Int
  let durationMs: Double
  let source: ReactLYExportAsset
  let reaction: ReactLYExportAsset
  let brand: ReactLYExportBrand
  let frames: [ReactLYExportFrame]

  init(_ value: [String: Any]) throws {
    guard Self.int(value["version"]) == 1 else {
      throw ReactLYExportError.invalidPlan("unsupported version")
    }
    width = try Self.positiveInt(value, "width")
    height = try Self.positiveInt(value, "height")
    fps = try Self.positiveInt(value, "fps")
    durationMs = try Self.positiveDouble(value, "durationMs")

    let sourceValue = try Self.dictionary(value["source"], "source")
    let reactionValue = try Self.dictionary(value["reaction"], "reaction")
    let brandValue = try Self.dictionary(value["brand"], "brand")
    let sourceKind = try Self.string(sourceValue, "kind")
    guard sourceKind == "image" || sourceKind == "video" else {
      throw ReactLYExportError.invalidPlan("unsupported source kind")
    }

    source = ReactLYExportAsset(
      url: try Self.url(sourceValue, "uri"),
      kind: sourceKind,
      loop: try Self.bool(sourceValue, "loop"),
      includeAudio: false,
      mirrored: false
    )
    reaction = ReactLYExportAsset(
      url: try Self.url(reactionValue, "uri"),
      kind: nil,
      loop: false,
      includeAudio: try Self.bool(reactionValue, "includeAudio"),
      mirrored: try Self.bool(reactionValue, "mirrored")
    )
    brand = ReactLYExportBrand(
      backgroundColor: try Self.color(brandValue, "backgroundColor"),
      accentColor: try Self.color(brandValue, "accentColor"),
      watermark: try Self.string(brandValue, "watermark"),
      tagline: try Self.string(brandValue, "tagline")
    )

    guard let frameValues = value["frames"] as? [[String: Any]], !frameValues.isEmpty else {
      throw ReactLYExportError.invalidPlan("frames must be a non-empty array")
    }
    frames = try frameValues.map { frame in
      let foreground = try Self.string(frame, "foreground")
      guard foreground == "source" || foreground == "reaction" else {
        throw ReactLYExportError.invalidPlan("invalid foreground value")
      }
      return ReactLYExportFrame(
        timeMs: try Self.nonNegativeDouble(frame, "timeMs"),
        sourceRect: try Self.rect(frame, "sourceRect"),
        reactionRect: try Self.rect(frame, "reactionRect"),
        sourceRadius: CGFloat(try Self.nonNegativeDouble(frame, "sourceRadius")),
        reactionRadius: CGFloat(try Self.nonNegativeDouble(frame, "reactionRadius")),
        brandOpacity: CGFloat(try Self.unitDouble(frame, "brandOpacity")),
        sourceInForeground: foreground == "source"
      )
    }
    guard zip(frames, frames.dropFirst()).allSatisfy({ pair in pair.0.timeMs <= pair.1.timeMs }) else {
      throw ReactLYExportError.invalidPlan("frames must be ordered by time")
    }
  }

  func frame(atMilliseconds timeMs: Double) -> ReactLYExportFrame {
    var low = 0
    var high = frames.count - 1
    while low <= high {
      let middle = (low + high) / 2
      if frames[middle].timeMs <= timeMs { low = middle + 1 } else { high = middle - 1 }
    }
    return frames[max(0, high)]
  }

  private static func dictionary(_ value: Any?, _ label: String) throws -> [String: Any] {
    guard let result = value as? [String: Any] else {
      throw ReactLYExportError.invalidPlan("\(label) must be an object")
    }
    return result
  }

  private static func int(_ value: Any?) -> Int? { (value as? NSNumber)?.intValue }
  private static func double(_ value: Any?) -> Double? { (value as? NSNumber)?.doubleValue }

  private static func positiveInt(_ parent: [String: Any], _ key: String) throws -> Int {
    guard let value = int(parent[key]), value > 0 else {
      throw ReactLYExportError.invalidPlan("\(key) must be positive")
    }
    return value
  }

  private static func positiveDouble(_ parent: [String: Any], _ key: String) throws -> Double {
    guard let value = double(parent[key]), value.isFinite, value > 0 else {
      throw ReactLYExportError.invalidPlan("\(key) must be positive and finite")
    }
    return value
  }

  private static func nonNegativeDouble(_ parent: [String: Any], _ key: String) throws -> Double {
    guard let value = double(parent[key]), value.isFinite, value >= 0 else {
      throw ReactLYExportError.invalidPlan("\(key) must be finite and non-negative")
    }
    return value
  }

  private static func unitDouble(_ parent: [String: Any], _ key: String) throws -> Double {
    let value = try nonNegativeDouble(parent, key)
    guard value <= 1 else { throw ReactLYExportError.invalidPlan("\(key) must not exceed one") }
    return value
  }

  private static func string(_ parent: [String: Any], _ key: String) throws -> String {
    guard let value = parent[key] as? String, !value.isEmpty else {
      throw ReactLYExportError.invalidPlan("\(key) must be a non-empty string")
    }
    return value
  }

  private static func bool(_ parent: [String: Any], _ key: String) throws -> Bool {
    guard let value = parent[key] as? Bool else {
      throw ReactLYExportError.invalidPlan("\(key) must be a boolean")
    }
    return value
  }

  private static func color(_ parent: [String: Any], _ key: String) throws -> String {
    let value = try string(parent, key)
    guard value.range(of: "^#[0-9A-Fa-f]{6}$", options: .regularExpression) != nil else {
      throw ReactLYExportError.invalidPlan("\(key) must be a six-digit hex color")
    }
    return value
  }

  private static func url(_ parent: [String: Any], _ key: String) throws -> URL {
    let rawValue = try string(parent, key)
    guard let value = URL(string: rawValue), value.isFileURL else {
      throw ReactLYExportError.invalidPlan("\(key) must be a local file URL")
    }
    return value
  }

  private static func rect(_ parent: [String: Any], _ key: String) throws -> CGRect {
    let value = try dictionary(parent[key], key)
    let x = try finiteDouble(value, "x")
    let y = try finiteDouble(value, "y")
    let width = try positiveDouble(value, "width")
    let height = try positiveDouble(value, "height")
    return CGRect(x: CGFloat(x), y: CGFloat(y), width: CGFloat(width), height: CGFloat(height))
  }

  private static func finiteDouble(_ parent: [String: Any], _ key: String) throws -> Double {
    guard let value = double(parent[key]), value.isFinite else {
      throw ReactLYExportError.invalidPlan("\(key) must be finite")
    }
    return value
  }
}
