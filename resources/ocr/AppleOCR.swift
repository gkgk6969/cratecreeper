import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count > 1 else {
    print("[]")
    exit(0)
}

let imagePath = CommandLine.arguments[1]

guard let image = NSImage(contentsOfFile: imagePath),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("[]")
    exit(0)
}

let semaphore = DispatchSemaphore(value: 0)
var output = "[]"

let request = VNRecognizeTextRequest { (req, _) in
    defer { semaphore.signal() }
    guard let observations = req.results as? [VNRecognizedTextObservation] else { return }
    let items: [[String: Any]] = observations.compactMap { obs in
        guard let candidate = obs.topCandidates(1).first else { return nil }
        let box = obs.boundingBox
        return [
            "text": candidate.string,
            "x": box.origin.x,
            "y": box.origin.y,
            "w": box.size.width,
            "h": box.size.height,
            "confidence": candidate.confidence,
        ]
    }
    if let data = try? JSONSerialization.data(withJSONObject: items, options: []),
       let json = String(data: data, encoding: .utf8) {
        output = json
    }
}
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
if #available(macOS 13.0, *) {
    request.automaticallyDetectsLanguage = true
}

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try handler.perform([request])
    _ = semaphore.wait(timeout: .now() + 30)
} catch {
    output = "[]"
}

print(output)
