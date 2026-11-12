/**
 * One icon language for the whole app: 24px grid, round 2.2px ink stroke, no emoji.
 * Gesture glyphs (hand-*) are the same hands the drawing toolbar and the tutorial teach, so a student
 * sees one drawing of "pinch", "erase", "undo" and "redo" everywhere.
 */
import type { CSSProperties, ReactNode } from "react";

const HAND_PALM =
  "a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7l-.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47";
const HAND_PALM_UNDO =
  "M17 11.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7a69.74 69.74 0 0 1 -.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47";

const P = (d: string, key?: string) => <path key={key ?? d} d={d} />;

const GLYPHS = {
  pencil: <>{P("M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4")}{P("M13.5 6.5l4 4")}</>,
  eraser: <>{P("M19 20h-10.5l-4.21 -4.3a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3")}{P("M18 13.3l-6.3 -6.3")}</>,
  undo: <>{P("M9 14l-4 -4l4 -4")}{P("M5 10h11a4 4 0 1 1 0 8h-1")}</>,
  redo: <>{P("M15 14l4 -4l-4 -4")}{P("M19 10h-11a4 4 0 1 0 0 8h1")}</>,
  trash: <>{P("M4 7h16")}{P("M10 11v6")}{P("M14 11v6")}{P("M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12")}{P("M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3")}</>,
  bulb: <>{P("M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7")}{P("M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3")}{P("M9.7 17h4.6")}</>,
  exit: <>{P("M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2")}{P("M9 12h12l-3 -3")}{P("M18 15l3 -3")}</>,
  check: <>{P("M5 12l5 5l10 -10")}</>,
  close: <>{P("M18 6l-12 12")}{P("M6 6l12 12")}</>,
  lock: <>{P("M5 11a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-8")}{P("M8 9v-3a4 4 0 0 1 8 0v3")}{P("M12 15v2")}</>,
  play: <>{P("M7 4v16l13 -8z")}</>,
  camera: <>{P("M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2")}<circle cx="12" cy="13" r="3" /></>,
  pointer: <>{P("M7.904 17.563a1.2 1.2 0 0 0 2.228 .308l2.09 -3.093l4.907 4.907a1.067 1.067 0 0 0 1.509 0l1.047 -1.047a1.067 1.067 0 0 0 0 -1.509l-4.907 -4.907l3.113 -2.09a1.2 1.2 0 0 0 -.309 -2.228l-13.582 -3.904l3.904 13.563")}</>,
  again: <>{P("M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4")}{P("M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4")}</>,
  plus: <>{P("M12 5v14")}{P("M5 12h14")}</>,
  swap: <>{P("M20 10h-16l5.5 -6")}{P("M4 14h16l-5.5 6")}</>,
  flag: <>{P("M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9")}{P("M5 21v-7")}</>,
  star: <>{P("M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z")}</>,
  "arrow-up": <>{P("M12 5v14")}{P("M18 11l-6 -6l-6 6")}</>,
  "arrow-down": <>{P("M12 5v14")}{P("M18 13l-6 6l-6 -6")}</>,
  "arrow-left": <>{P("M5 12h14")}{P("M5 12l6 6")}{P("M5 12l6 -6")}</>,
  "arrow-right": <>{P("M5 12h14")}{P("M13 18l6 -6")}{P("M13 6l6 6")}</>,
  "thumb-up": <>{P("M7 11v8a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-7a1 1 0 0 1 1 -1h3a4 4 0 0 0 4 -4v-1a2 2 0 0 1 4 0v5h3a2 2 0 0 1 2 2l-1 5a2 3 0 0 1 -2 2h-7a3 3 0 0 1 -3 -3")}</>,
  /** Pinch: the draw gesture. */
  "hand-draw": <>{P("M8 13v-2.5a1.5 1.5 0 0 1 3 0v1")}{P("M11 11.5v-2a1.5 1.5 0 0 1 3 0v2.5")}{P("M14 10.5a1.5 1.5 0 0 1 3 0v1.5")}{P(`M17 11.5${HAND_PALM}`)}<circle cx="9.5" cy="7.5" r="2.5" /></>,
  /** Open palm: the erase gesture. */
  "hand-erase": <>{P("M8 11v-3.5a1.5 1.5 0 0 1 3 0v2.5")}{P("M11 9.5v-3a1.5 1.5 0 0 1 3 0v3.5")}{P("M14 7.5a1.5 1.5 0 0 1 3 0v2.5")}{P(`M17 9.5${HAND_PALM}`)}</>,
  "hand-undo": <>{P("M8 13v-8.5a1.5 1.5 0 0 1 3 0v7.5")}{P("M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5")}{P("M14 10.5a1.5 1.5 0 0 1 3 0v1.5")}{P(HAND_PALM_UNDO)}</>,
  "hand-redo": <>{P("M8 13v-8.5a1.5 1.5 0 0 1 3 0v7.5")}{P("M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5")}{P("M14 5.5a1.5 1.5 0 0 1 3 0v6.5")}{P(HAND_PALM_UNDO)}</>,
  /** Object glyphs for the mission hint. */
  block: <>{P("M4 5h16v14h-16z")}{P("M4 12h16")}{P("M12 5v7")}{P("M8 12v7")}{P("M16 12v7")}</>,
  plank: <>{P("M2.5 9h19v6h-19z")}{P("M6 9v2")}{P("M18 9v2")}{P("M9 13.5h6")}</>,
  ladder: <>{P("M8 3v18")}{P("M16 3v18")}{P("M8 7.5h8")}{P("M8 12h8")}{P("M8 16.5h8")}</>,
  spike: <>{P("M3 19l3 -12l3 12")}{P("M9 19l3 -12l3 12")}{P("M15 19l3 -12l3 12")}</>,
  rock: <>{P("M4 17l2 -7l5 -4l6 2l3 6l-3 5h-10z")}{P("M9 12l3 2l3 -1")}</>,
  rope: <>{P("M5 4c6 2 -4 6 2 8s-4 6 2 8")}{P("M17 4l-2 4l4 2l-2 4")}</>,
  bucket: <>{P("M5 8h14l-1.5 11a1 1 0 0 1 -1 1h-9a1 1 0 0 1 -1 -1l-1.5 -11")}{P("M5 8a7 3 0 0 1 14 0")}{P("M8 5a4 4 0 0 1 8 0")}</>,
  /** Thinman: a tiny stick figure. */
  thinman: <><circle cx="12" cy="6" r="3" />{P("M12 9v7")}{P("M12 16l-3.5 5")}{P("M12 16l3.5 5")}{P("M12 11.5l-4 2.5")}{P("M12 11.5l4 2")}</>,
  /** Small hand with a pull arrow for the bookmark pull gesture. */
  "pull-down": <>{P("M12 3v12")}{P("M7 11l5 5l5 -5")}{P("M6 20h12")}</>,
  sparkles: <>{P("M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2")}{P("M16 6a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2")}{P("M9 18a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6")}</>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof GLYPHS;

export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];

/** Map a level catalog label to an object glyph; unknown labels fall back to a pencil. */
export function objectIconFor(labelId: string): IconName {
  switch (labelId) {
    case "balok": case "bangku": case "meja": return "block";
    case "papan": case "jembatan": case "papan luncur": return "plank";
    case "tangga": case "anak tangga": case "pagar": return "ladder";
    case "duri": case "kaktus": case "gergaji": case "zigzag": case "petir": return "spike";
    case "batu": return "rock";
    case "tali": case "ular": case "garis": return "rope";
    case "ember": return "bucket";
    default: return "pencil";
  }
}

export interface IconProps {
  name: IconName;
  size?: number;
  /** Stroke width on the 24px grid. */
  stroke?: number;
  /** Optional soft fill behind the stroke (used for chunky sticker icons). */
  fill?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function Icon({ name, size = 22, stroke = 2.2, fill = "none", className, style, title }: IconProps) {
  return (
    <svg
      className={`nb-icon${className ? " " + className : ""}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      focusable="false"
      style={style}
    >
      {GLYPHS[name]}
    </svg>
  );
}
