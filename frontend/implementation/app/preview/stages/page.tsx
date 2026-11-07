import type { Metadata } from "next";
import { StagePreview } from "../../../src/components/stage-preview/StagePreview";

export const metadata: Metadata = {
  title: "Sketchbook Universe · HD Animated Stage Art",
  description: "Preview visual empat panggung SVG. Ilustrasi saja, tanpa logika permainan.",
};

export default function StagePreviewPage() {
  return <StagePreview />;
}
