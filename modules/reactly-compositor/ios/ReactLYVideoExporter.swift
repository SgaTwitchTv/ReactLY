import AVFoundation
import CoreGraphics
import CoreVideo
import UIKit

final class ReactLYVideoExporter {
  private let plan: ReactLYExportPlan

  init(plan: ReactLYExportPlan) {
    self.plan = plan
  }

  func export(to outputURL: URL) async throws {
    let silentVideoURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("reactly-video-\(UUID().uuidString).mp4")
    defer { try? FileManager.default.removeItem(at: silentVideoURL) }

    try await renderVideo(to: silentVideoURL)
    if plan.reaction.includeAudio {
      try await muxReactionAudio(videoURL: silentVideoURL, outputURL: outputURL)
    } else {
      try FileManager.default.moveItem(at: silentVideoURL, to: outputURL)
    }
  }

  private func renderVideo(to outputURL: URL) async throws {
    let sourceProvider = try await FrameProvider(asset: plan.source, label: "source")
    let reactionProvider = try await FrameProvider(asset: plan.reaction, label: "reaction")
    let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
    let input = AVAssetWriterInput(
      mediaType: .video,
      outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: plan.width,
        AVVideoHeightKey: plan.height,
        AVVideoCompressionPropertiesKey: [
          AVVideoAverageBitRateKey: 6_000_000,
          AVVideoExpectedSourceFrameRateKey: plan.fps,
          AVVideoMaxKeyFrameIntervalKey: plan.fps * 2,
        ],
      ]
    )
    input.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: input,
      sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: plan.width,
        kCVPixelBufferHeightKey as String: plan.height,
        kCVPixelBufferIOSurfacePropertiesKey as String: [:],
      ]
    )
    guard writer.canAdd(input) else { throw ReactLYExportError.cannotCreateWriter }
    writer.add(input)
    guard writer.startWriting() else {
      throw ReactLYExportError.writerFailed(writer.error?.localizedDescription ?? "unknown startup error")
    }
    writer.startSession(atSourceTime: .zero)

    let frameCount = Int(ceil(plan.durationMs * Double(plan.fps) / 1_000.0))
    for index in 0..<frameCount {
      try Task.checkCancellation()
      while !input.isReadyForMoreMediaData {
        try Task.checkCancellation()
        try await Task.sleep(nanoseconds: 2_000_000)
      }

      let timeMs = Double(index) * 1_000.0 / Double(plan.fps)
      let sourceImage = try sourceProvider.image(atMilliseconds: timeMs, looping: plan.source.loop)
      let reactionImage = try reactionProvider.image(atMilliseconds: timeMs, looping: false)
      guard let pixelBuffer = makePixelBuffer(pool: adaptor.pixelBufferPool) else {
        throw ReactLYExportError.cannotCreatePixelBuffer
      }
      try draw(
        frame: plan.frame(atMilliseconds: timeMs),
        sourceImage: sourceImage,
        reactionImage: reactionImage,
        into: pixelBuffer
      )
      let presentationTime = CMTime(value: CMTimeValue(index), timescale: CMTimeScale(plan.fps))
      guard adaptor.append(pixelBuffer, withPresentationTime: presentationTime) else {
        throw ReactLYExportError.writerFailed(writer.error?.localizedDescription ?? "frame append failed")
      }
    }

    input.markAsFinished()
    try await finish(writer)
  }

  private func makePixelBuffer(pool: CVPixelBufferPool?) -> CVPixelBuffer? {
    guard let pool else { return nil }
    var pixelBuffer: CVPixelBuffer?
    guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pixelBuffer) == kCVReturnSuccess else {
      return nil
    }
    return pixelBuffer
  }

  private func draw(
    frame: ReactLYExportFrame,
    sourceImage: CGImage,
    reactionImage: CGImage,
    into pixelBuffer: CVPixelBuffer
  ) throws {
    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }
    guard
      let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer),
      let context = CGContext(
        data: baseAddress,
        width: plan.width,
        height: plan.height,
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue
          | CGImageAlphaInfo.premultipliedFirst.rawValue
      )
    else { throw ReactLYExportError.cannotCreatePixelBuffer }

    context.translateBy(x: 0, y: CGFloat(plan.height))
    context.scaleBy(x: 1, y: -1)
    context.setFillColor(UIColor(hex: plan.brand.backgroundColor).cgColor)
    context.fill(
      CGRect(x: 0, y: 0, width: CGFloat(plan.width), height: CGFloat(plan.height))
    )
    drawBrand(frame: frame, context: context)

    if frame.sourceInForeground {
      drawMedia(reactionImage, in: frame.reactionRect, radius: frame.reactionRadius, mirrored: plan.reaction.mirrored, context: context)
      drawMedia(sourceImage, in: frame.sourceRect, radius: frame.sourceRadius, mirrored: false, context: context)
    } else {
      drawMedia(sourceImage, in: frame.sourceRect, radius: frame.sourceRadius, mirrored: false, context: context)
      drawMedia(reactionImage, in: frame.reactionRect, radius: frame.reactionRadius, mirrored: plan.reaction.mirrored, context: context)
    }
  }

  private func drawBrand(frame: ReactLYExportFrame, context: CGContext) {
    guard frame.brandOpacity > 0 else { return }
    UIGraphicsPushContext(context)
    defer { UIGraphicsPopContext() }
    let centerY = CGFloat(plan.height) / 2
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    let watermarkAttributes: [NSAttributedString.Key: Any] = [
      .font: UIFont.systemFont(ofSize: CGFloat(plan.width) * 0.13, weight: .black),
      .foregroundColor: UIColor(hex: plan.brand.accentColor).withAlphaComponent(frame.brandOpacity * 0.28),
      .paragraphStyle: paragraph,
      .kern: CGFloat(plan.width) * 0.004,
    ]
    let taglineAttributes: [NSAttributedString.Key: Any] = [
      .font: UIFont.systemFont(ofSize: CGFloat(plan.width) * 0.027, weight: .bold),
      .foregroundColor: UIColor.white.withAlphaComponent(frame.brandOpacity * 0.35),
      .paragraphStyle: paragraph,
      .kern: CGFloat(plan.width) * 0.003,
    ]
    let width = CGFloat(plan.width)
    (plan.brand.watermark as NSString).draw(
      in: CGRect(x: 0, y: centerY - width * 0.09, width: width, height: width * 0.16),
      withAttributes: watermarkAttributes
    )
    (plan.brand.tagline as NSString).draw(
      in: CGRect(x: 0, y: centerY + CGFloat(plan.height) * 0.025, width: width, height: width * 0.06),
      withAttributes: taglineAttributes
    )
  }

  private func drawMedia(
    _ image: CGImage,
    in rect: CGRect,
    radius: CGFloat,
    mirrored: Bool,
    context: CGContext
  ) {
    context.saveGState()
    let path = UIBezierPath(roundedRect: rect, cornerRadius: min(radius, min(rect.width, rect.height) / 2))
    path.addClip()
    if mirrored {
      context.translateBy(x: rect.midX * 2, y: 0)
      context.scaleBy(x: -1, y: 1)
    }

    let imageSize = CGSize(width: CGFloat(image.width), height: CGFloat(image.height))
    let scale = max(rect.width / imageSize.width, rect.height / imageSize.height)
    let drawSize = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
    let drawRect = CGRect(
      x: rect.midX - drawSize.width / 2,
      y: rect.midY - drawSize.height / 2,
      width: drawSize.width,
      height: drawSize.height
    )
    context.interpolationQuality = .high
    context.draw(image, in: drawRect)
    context.restoreGState()

    guard radius > 0 else { return }
    context.saveGState()
    context.setStrokeColor(UIColor(hex: plan.brand.accentColor).cgColor)
    context.setLineWidth(CGFloat(plan.width) * 0.006)
    context.addPath(path.cgPath)
    context.strokePath()
    context.restoreGState()
  }

  private func muxReactionAudio(videoURL: URL, outputURL: URL) async throws {
    let videoAsset = AVURLAsset(url: videoURL)
    let reactionAsset = AVURLAsset(url: plan.reaction.url)
    guard let videoTrack = try await videoAsset.loadTracks(withMediaType: .video).first else {
      throw ReactLYExportError.missingVideoTrack("rendered output")
    }
    guard let audioTrack = try await reactionAsset.loadTracks(withMediaType: .audio).first else {
      throw ReactLYExportError.audioMuxFailed("the reaction recording has no audio track")
    }
    let composition = AVMutableComposition()
    guard
      let compositionVideo = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
      let compositionAudio = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
    else { throw ReactLYExportError.audioMuxFailed("could not create composition tracks") }

    let duration = CMTime(milliseconds: plan.durationMs)
    let reactionDuration = try await reactionAsset.load(.duration)
    let audioDuration = CMTimeMinimum(duration, reactionDuration)
    try compositionVideo.insertTimeRange(
      CMTimeRange(start: .zero, duration: duration),
      of: videoTrack,
      at: .zero
    )
    try compositionAudio.insertTimeRange(
      CMTimeRange(start: .zero, duration: audioDuration),
      of: audioTrack,
      at: .zero
    )
    guard let session = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
      throw ReactLYExportError.audioMuxFailed("could not create export session")
    }
    session.outputURL = outputURL
    session.outputFileType = .mp4
    session.shouldOptimizeForNetworkUse = false
    await withTaskCancellationHandler {
      await export(session)
    } onCancel: {
      session.cancelExport()
    }
    guard session.status == .completed else {
      throw ReactLYExportError.audioMuxFailed(session.error?.localizedDescription ?? "export session failed")
    }
  }

  private func finish(_ writer: AVAssetWriter) async throws {
    await withCheckedContinuation { continuation in
      writer.finishWriting { continuation.resume() }
    }
    guard writer.status == .completed else {
      throw ReactLYExportError.writerFailed(writer.error?.localizedDescription ?? "writer did not complete")
    }
  }

  private func export(_ session: AVAssetExportSession) async {
    await withCheckedContinuation { continuation in
      session.exportAsynchronously { continuation.resume() }
    }
  }
}

private final class FrameProvider {
  private enum Storage {
    case image(CGImage)
    case video(AVAssetImageGenerator, Double)
  }
  private let storage: Storage
  private let label: String

  init(asset: ReactLYExportAsset, label: String) async throws {
    self.label = label
    if asset.kind == "image" {
      guard let image = UIImage(contentsOfFile: asset.url.path)?.normalizedCGImage else {
        throw ReactLYExportError.frameGenerationFailed(label)
      }
      storage = .image(image)
    } else {
      let avAsset = AVURLAsset(url: asset.url)
      guard !(try await avAsset.loadTracks(withMediaType: .video)).isEmpty else {
        throw ReactLYExportError.missingVideoTrack(label)
      }
      let duration = try await avAsset.load(.duration).seconds * 1_000
      guard duration.isFinite, duration > 0 else {
        throw ReactLYExportError.frameGenerationFailed(label)
      }
      let generator = AVAssetImageGenerator(asset: avAsset)
      generator.appliesPreferredTrackTransform = true
      generator.requestedTimeToleranceBefore = CMTime(value: 1, timescale: 60)
      generator.requestedTimeToleranceAfter = CMTime(value: 1, timescale: 60)
      storage = .video(generator, duration)
    }
  }

  func image(atMilliseconds timeMs: Double, looping: Bool) throws -> CGImage {
    switch storage {
    case .image(let image): return image
    case .video(let generator, let durationMs):
      let requestedMs = looping ? timeMs.truncatingRemainder(dividingBy: durationMs) : min(timeMs, max(0, durationMs - 1))
      do {
        return try generator.copyCGImage(at: CMTime(milliseconds: requestedMs), actualTime: nil)
      } catch {
        throw ReactLYExportError.frameGenerationFailed(label)
      }
    }
  }
}

private extension CMTime {
  init(milliseconds: Double) {
    self = CMTime(seconds: milliseconds / 1_000, preferredTimescale: 60_000)
  }
}

private extension UIImage {
  var normalizedCGImage: CGImage? {
    if imageOrientation == .up { return cgImage }
    let renderer = UIGraphicsImageRenderer(size: size)
    return renderer.image { _ in draw(in: CGRect(origin: .zero, size: size)) }.cgImage
  }
}

private extension UIColor {
  convenience init(hex: String) {
    let value = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    var rgb: UInt64 = 0
    Scanner(string: value).scanHexInt64(&rgb)
    self.init(
      red: CGFloat((rgb >> 16) & 0xff) / 255,
      green: CGFloat((rgb >> 8) & 0xff) / 255,
      blue: CGFloat(rgb & 0xff) / 255,
      alpha: 1
    )
  }
}
