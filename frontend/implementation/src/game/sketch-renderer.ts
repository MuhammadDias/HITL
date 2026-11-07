import type { DrawingInput, ObjectBehavior } from "../domain/types";

export interface SketchRenderOptions {
  width: number;
  height: number;
  behavior: ObjectBehavior;
  label?: string;
}

/**
 * Transforms normalized student strokes into an authentic tactile SVG sprite.
 *
 * Requirements (Mandat Section 2 & 7.1):
 * - Siswa harus merasa bahwa objek yang masuk ke dunia adalah HASIL GAMBAR MEREKA SENDIRI.
 * - Mempertahankan goresan asli siswa sepanjang transisi Draw -> World.
 * - Menggunakan raster/SVG transparan dengan texture coretan asli, sementara collider fisik tetap stabil.
 */

// Constants for validation and safe rendering
const MIN_DIMENSION = 1;
const MAX_DIMENSION = 2000;
const MAX_STROKES = 50;
const MAX_POINTS_PER_STROKE = 200;
const STROKE_WIDTH = 3;
const DOT_RADIUS = 2;

function clampDimension(value: number): number {
  return Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, Math.round(value)));
}

function sanitizeStroke(stroke: { x: number; y: number }[]): { x: number; y: number }[] {
  return stroke
    .filter((pt) => typeof pt.x === "number" && typeof pt.y === "number" && Number.isFinite(pt.x) && Number.isFinite(pt.y))
    .map((pt) => ({
      x: Math.max(0, Math.min(1, pt.x)),
      y: Math.max(0, Math.min(1, pt.y)),
    }))
    .slice(0, MAX_POINTS_PER_STROKE);
}

export function generateSketchSvg(
  input: DrawingInput | null,
  options: SketchRenderOptions,
): string {
  const { width, height, behavior, label } = options;
  const safeW = clampDimension(width);
  const safeH = clampDimension(height);

  // Determine palette based on behavior
  const bgFill =
    behavior === "solid"
      ? "#edd9be" // Warm craft-paper / wood-cardboard tone
      : behavior === "danger"
        ? "#f8d5cb" // Caution red-tinted papercraft
        : "#e5e9ec"; // Neutral sketch gray

  const borderColor =
    behavior === "solid"
      ? "#8c6b45"
      : behavior === "danger"
        ? "#c0392b"
        : "#7f8c8d";

  const bannerColor =
    behavior === "solid"
      ? "#6e5030"
      : behavior === "danger"
        ? "#962d22"
        : "#556270";

  // Build stroke SVG paths if drawing input exists
  let strokesSvg = "";
  if (input && input.strokes && input.strokes.length > 0) {
    // Determine inner drawing area with padding for aesthetic framing
    const padX = Math.min(10, safeW * 0.08);
    const padY = Math.min(6, safeH * 0.12);
    const drawW = safeW - padX * 2;
    const drawH = safeH - padY * 2;

    const strokePaths: string[] = [];
    const strokesToProcess = input.strokes.slice(0, MAX_STROKES);
    
    for (const stroke of strokesToProcess) {
      const cleanStroke = sanitizeStroke(stroke);
      if (cleanStroke.length === 0) continue;
      
      if (cleanStroke.length === 1) {
        // Single dot
        const pt = cleanStroke[0]!;
        const cx = (padX + pt.x * drawW).toFixed(1);
        const cy = (padY + pt.y * drawH).toFixed(1);
        strokePaths.push(`<circle cx="${cx}" cy="${cy}" r="${DOT_RADIUS}" fill="#23211d" />`);
        continue;
      }

      // Multi-point stroke: convert normalized [0,1] coordinates into pixel coordinates
      let d = `M ${(padX + cleanStroke[0]!.x * drawW).toFixed(1)} ${(padY + cleanStroke[0]!.y * drawH).toFixed(1)}`;
      for (let i = 1; i < cleanStroke.length; i++) {
        const pt = cleanStroke[i]!;
        d += ` L ${(padX + pt.x * drawW).toFixed(1)} ${(padY + pt.y * drawH).toFixed(1)}`;
      }
      strokePaths.push(
        `<path d="${d}" stroke="#23211d" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" fill="none" />`,
      );
    }
    
    if (strokePaths.length > 0) {
      strokesSvg = strokePaths.join("\n    ");
    } else {
      // All strokes were invalid/empty - use placeholder
      const midY = (safeH / 2).toFixed(1);
      strokesSvg = `<line x1="${(safeW * 0.2).toFixed(1)}" y1="${midY}" x2="${(safeW * 0.8).toFixed(1)}" y2="${midY}" stroke="#23211d" stroke-width="2.5" stroke-dasharray="4 2" />`;
    }
  } else {
    // Fallback simple sketch icon if no strokes present
    const midY = (safeH / 2).toFixed(1);
    strokesSvg = `<line x1="${(safeW * 0.2).toFixed(1)}" y1="${midY}" x2="${(safeW * 0.8).toFixed(1)}" y2="${midY}" stroke="#23211d" stroke-width="2.5" stroke-dasharray="4 2" />`;
  }

  // Display label on badge
  const displayLabel = label ? label.slice(0, 16) : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${safeW}" height="${safeH}" viewBox="0 0 ${safeW} ${safeH}">
  <defs>
    <filter id="paper-shadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1" flood-color="#111" flood-opacity="0.18" />
    </filter>
  </defs>
  <!-- Papercraft cutout backing -->
  <rect x="1" y="1" width="${safeW - 2}" height="${safeH - 2}" rx="3" ry="3" fill="${bgFill}" stroke="${borderColor}" stroke-width="1.8" filter="url(#paper-shadow)" />
  
  <!-- Subtle tactile texture lines -->
  <line x1="4" y1="${safeH - 3}" x2="${safeW - 4}" y2="${safeH - 3}" stroke="${borderColor}" stroke-width="0.8" stroke-opacity="0.4" stroke-dasharray="3 3" />
  
  <!-- Student original hand-drawn ink strokes -->
  <g class="student-strokes">
    ${strokesSvg}
  </g>
</svg>`;
}

export function generateSketchDataUri(
  input: DrawingInput | null,
  options: SketchRenderOptions,
): string {
  const svg = generateSketchSvg(input, options);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
