import { describe, expect, it } from "vitest";
import { CAMERA_MESSAGES, classifyCameraError, messageFor } from "@/src/camera/messages";

const wordCount = (s: string) => s.trim().split(/\s+/).length;

describe("student-facing camera messages", () => {
  it("every reason is Indonesian, <= 8 words, and free of tech jargon", () => {
    for (const [reason, text] of Object.entries(CAMERA_MESSAGES)) {
      expect(wordCount(text), reason).toBeLessThanOrEqual(8);
      expect(text, reason).not.toMatch(/GPU|CPU|WebGL|WASM|MediaPipe|stream|delegate|exception|error/i);
    }
  });

  it("failures that have a working alternative name it (mouse / keyboard)", () => {
    for (const reason of ["permission-denied", "camera-unavailable", "camera-lost", "camera-failed", "model-error", "tracker-error"] as const) {
      expect(messageFor(reason)).toMatch(/mouse|keyboard/i);
    }
  });

  it("classifies DOMException-style names", () => {
    expect(classifyCameraError({ name: "NotAllowedError" })).toBe("permission-denied");
    expect(classifyCameraError({ name: "NotFoundError" })).toBe("camera-unavailable");
    expect(classifyCameraError({ name: "OverconstrainedError" })).toBe("camera-unavailable");
    expect(classifyCameraError({ name: "NotReadableError" })).toBe("camera-busy");
    expect(classifyCameraError(new Error("Failed to fetch model asset"))).toBe("model-error");
    expect(classifyCameraError(new Error("boom"))).toBe("tracker-error");
  });
});
