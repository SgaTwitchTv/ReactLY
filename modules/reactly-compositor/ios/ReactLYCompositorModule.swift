import AVFoundation
import ExpoModulesCore
import Foundation

public final class ReactLYCompositorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReactLYCompositor")

    AsyncFunction("exportAsync") { (rawPlan: [String: Any]) async throws -> [String: Any] in
      let plan = try ReactLYExportPlan(rawPlan)
      let outputURL = FileManager.default.temporaryDirectory
        .appendingPathComponent("reactly-\(UUID().uuidString).mp4")

      do {
        try await ReactLYVideoExporter(plan: plan).export(to: outputURL)
        let attributes = try FileManager.default.attributesOfItem(atPath: outputURL.path)
        let sizeBytes = (attributes[.size] as? NSNumber)?.int64Value ?? 0
        guard sizeBytes > 0 else {
          throw ReactLYExportError.emptyOutput
        }

        return [
          "uri": outputURL.absoluteString,
          "mimeType": "video/mp4",
          "sizeBytes": sizeBytes,
        ]
      } catch {
        try? FileManager.default.removeItem(at: outputURL)
        throw error
      }
    }
  }
}

enum ReactLYExportError: LocalizedError {
  case invalidPlan(String)
  case missingVideoTrack(String)
  case cannotCreateWriter
  case cannotCreatePixelBuffer
  case frameGenerationFailed(String)
  case writerFailed(String)
  case audioMuxFailed(String)
  case emptyOutput

  var errorDescription: String? {
    switch self {
    case .invalidPlan(let message): return "Invalid ReactLY export plan: \(message)"
    case .missingVideoTrack(let label): return "The ReactLY \(label) has no readable video track."
    case .cannotCreateWriter: return "ReactLY could not create the iOS video writer."
    case .cannotCreatePixelBuffer: return "ReactLY could not allocate an iOS export frame."
    case .frameGenerationFailed(let label): return "ReactLY could not decode a \(label) frame."
    case .writerFailed(let message): return "ReactLY could not encode the video: \(message)"
    case .audioMuxFailed(let message): return "ReactLY could not attach reaction audio: \(message)"
    case .emptyOutput: return "ReactLY produced an empty iOS export."
    }
  }
}
