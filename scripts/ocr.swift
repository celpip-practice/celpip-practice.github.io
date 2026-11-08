// Usage: ocr <image>...   Prints JSON lines: {"file":..., "w":..,"h":.., "lines":[{"t":text,"x":,"y":,"w":,"h":,"c":conf}]}
// Coordinates are normalized with origin top-left.
import Foundation
import Vision
import AppKit

func ocr(_ path: String) -> [String: Any] {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        return ["file": path, "error": "load failed"]
    }
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = true
    req.recognitionLanguages = ["en-US"]
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    try? handler.perform([req])
    var lines: [[String: Any]] = []
    for obs in req.results ?? [] {
        guard let cand = obs.topCandidates(1).first else { continue }
        let b = obs.boundingBox
        lines.append(["t": cand.string, "x": b.minX, "y": 1 - b.maxY, "w": b.width, "h": b.height, "c": cand.confidence])
    }
    return ["file": path, "w": cg.width, "h": cg.height, "lines": lines]
}

for p in CommandLine.arguments.dropFirst() {
    let r = ocr(p)
    if let d = try? JSONSerialization.data(withJSONObject: r), let s = String(data: d, encoding: .utf8) {
        print(s)
    }
}
