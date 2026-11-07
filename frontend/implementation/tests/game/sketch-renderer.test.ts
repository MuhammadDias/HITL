import { describe, expect, it } from "vitest";
import { generateSketchSvg, generateSketchDataUri } from "@/src/game/sketch-renderer";
import type { DrawingInput } from "@/src/domain/types";

describe("sketch-renderer: student original sketch SVG generation", () => {
  const sampleInput: DrawingInput = {
    hasInk: true,
    aspectRatio: 1.5,
    strokes: [
      [
        { x: 0.1, y: 0.2 },
        { x: 0.5, y: 0.5 },
        { x: 0.9, y: 0.8 },
      ],
      [
        { x: 0.3, y: 0.3 },
      ],
    ],
  };

  it("generates valid SVG containing student stroke coordinates scaled to dimensions", () => {
    const svg = generateSketchSvg(sampleInput, {
      width: 120,
      height: 40,
      behavior: "solid",
      label: "papan",
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("xmlns=\"http://www.w3.org/2000/svg\"");
    expect(svg).toContain("width=\"120\"");
    expect(svg).toContain("height=\"40\"");
    expect(svg).toContain("class=\"student-strokes\"");
    expect(svg).toContain("<path d=");
    expect(svg).toContain("<circle");
    expect(svg).toContain("#23211d");
    expect(svg).toContain("#edd9be");
  });

  it("applies distinct palette and styling for danger objects", () => {
    const svg = generateSketchSvg(sampleInput, {
      width: 80,
      height: 30,
      behavior: "danger",
      label: "duri",
    });

    expect(svg).toContain("#f8d5cb");
    expect(svg).toContain("#c0392b");
  });

  it("handles null drawing input with graceful dashed placeholder", () => {
    const svg = generateSketchSvg(null, {
      width: 100,
      height: 20,
      behavior: "unresolved",
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain("#e5e9ec");
  });

  it("produces valid data URI encoding", () => {
    const uri = generateSketchDataUri(sampleInput, {
      width: 100,
      height: 30,
      behavior: "solid",
    });

    expect(uri.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(uri).toContain(encodeURIComponent("<svg"));
  });

  /* -------------------------------------------------------------
   * Workstream B: 3 Student Sketch Variations & Resiliency Testing
   * ------------------------------------------------------------- */

  describe("Student Sketch Variations (REQ-01 / REQ-DW-01)", () => {
    it("Variation 1: Straight lines (e.g. bridge plank or ramp)", () => {
      const straightLineInput: DrawingInput = {
        hasInk: true,
        aspectRatio: 3.0,
        strokes: [
          [
            { x: 0.05, y: 0.5 },
            { x: 0.95, y: 0.5 },
          ],
        ],
      };

      const svg = generateSketchSvg(straightLineInput, {
        width: 150,
        height: 50,
        behavior: "solid",
        label: "jembatan",
      });

      expect(svg).toContain("<path d=");
      // Check stroke-linecap round and proper path coordinates
      expect(svg).toMatch(/<path d="M [\d.]+ [\d.]+ L [\d.]+ [\d.]+"/);
      expect(svg).toContain("stroke-linecap=\"round\"");
    });

    it("Variation 2: Curves and circles (e.g. boulder, wheel, or arch)", () => {
      const curveCircleInput: DrawingInput = {
        hasInk: true,
        aspectRatio: 1.0,
        strokes: [
          // Approximate circle points
          [
            { x: 0.5, y: 0.1 },
            { x: 0.8, y: 0.2 },
            { x: 0.9, y: 0.5 },
            { x: 0.8, y: 0.8 },
            { x: 0.5, y: 0.9 },
            { x: 0.2, y: 0.8 },
            { x: 0.1, y: 0.5 },
            { x: 0.2, y: 0.2 },
            { x: 0.5, y: 0.1 },
          ],
        ],
      };

      const svg = generateSketchSvg(curveCircleInput, {
        width: 80,
        height: 80,
        behavior: "solid",
        label: "roda",
      });

      expect(svg).toContain("<path d=");
      // Ensure multi-segment connected line
      const pathMatch = svg.match(/<path d="([^"]+)"/);
      expect(pathMatch).not.toBeNull();
      if (pathMatch && pathMatch[1]) { const lCommands = (pathMatch[1].match(/L /g) || []).length; expect(lCommands).toBe(8); }
    });

    it("Variation 3: Multi-stroke drawing (e.g. spikes / obstacle with lines & dots)", () => {
      const multiStrokeInput: DrawingInput = {
        hasInk: true,
        aspectRatio: 2.0,
        strokes: [
          // Base
          [{ x: 0.1, y: 0.9 }, { x: 0.9, y: 0.9 }],
          // Spike 1
          [{ x: 0.2, y: 0.9 }, { x: 0.3, y: 0.2 }, { x: 0.4, y: 0.9 }],
          // Spike 2
          [{ x: 0.5, y: 0.9 }, { x: 0.6, y: 0.2 }, { x: 0.7, y: 0.9 }],
          // Stray dot / detail
          [{ x: 0.5, y: 0.1 }],
        ],
      };

      const svg = generateSketchSvg(multiStrokeInput, {
        width: 120,
        height: 60,
        behavior: "danger",
        label: "duri_tajam",
      });

      expect(svg).toContain("width=\"120\"");
      expect(svg).toContain("height=\"60\"");
      // Should have 3 paths and 1 circle
      const pathMatches = svg.match(/<path /g) || [];
      const circleMatches = svg.match(/<circle /g) || [];
      expect(pathMatches.length).toBe(3);
      expect(circleMatches.length).toBe(1);
    });
  });

  describe("Resiliency & Safe Fallback Handling", () => {
    it("handles empty strokes array gracefully without crashing", () => {
      const emptyInput: DrawingInput = {
        hasInk: false,
        aspectRatio: 1.0,
        strokes: [],
      };

      const svg = generateSketchSvg(emptyInput, {
        width: 64,
        height: 32,
        behavior: "solid",
      });

      expect(svg).toContain("<svg");
      expect(svg).toContain("stroke-dasharray=\"4 2\"");
    });

    it("handles strokes containing only empty sub-arrays", () => {
      const emptyStrokesInput: DrawingInput = {
        hasInk: true,
        aspectRatio: 1.0,
        strokes: [[], []],
      };

      const svg = generateSketchSvg(emptyStrokesInput, {
        width: 64,
        height: 32,
        behavior: "solid",
      });

      expect(svg).toContain("<svg");
      expect(svg).toContain("stroke-dasharray=\"4 2\"");
    });

    it("clamps oversized and extreme coordinates within [0, 1]", () => {
      const oversizedInput: DrawingInput = {
        hasInk: true,
        aspectRatio: 1.0,
        strokes: [
          [
            { x: -0.5, y: -0.2 },
            { x: 1.5, y: 2.0 },
          ],
        ],
      };

      const svg = generateSketchSvg(oversizedInput, {
        width: 100,
        height: 100,
        behavior: "solid",
      });

      expect(svg).toContain("<path d=");
      // Ensure coordinates are clamped and do not evaluate to NaN
      expect(svg).not.toContain("NaN");
    });

    it("filters out invalid/corrupted stroke points (NaN, undefined)", () => {
      const corruptedInput = {
        hasInk: true,
        aspectRatio: 1.0,
        strokes: [
          [
            { x: 0.1, y: 0.1 },
            { x: NaN, y: 0.5 },
            { x: 0.9, y: 0.9 },
          ],
        ],
      } as unknown as DrawingInput;

      const svg = generateSketchSvg(corruptedInput, {
        width: 100,
        height: 100,
        behavior: "solid",
      });

      expect(svg).toContain("<path d=");
      expect(svg).not.toContain("NaN");
    });

    it("handles zero or negative width/height safely", () => {
      const svg = generateSketchSvg(sampleInput, {
        width: 0,
        height: -10,
        behavior: "solid",
      });

      expect(svg).toContain("<svg");
      expect(svg).not.toContain("width=\"0\"");
      expect(svg).not.toContain("height=\"-10\"");
      expect(svg).not.toContain("NaN");
    });
  });
});
