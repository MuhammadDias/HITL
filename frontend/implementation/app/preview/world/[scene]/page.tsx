import { notFound } from "next/navigation";
import { StageWorld } from "../../../../src/components/stage-preview/StageWorld";
import type { SceneIndex } from "../../../../src/components/stage-preview/scene-metadata";

export function generateStaticParams() {
  return ["0", "1", "2", "3"].map(scene => ({ scene }));
}
export const dynamicParams = false;

/** Clean visual acceptance surface only; no gameplay routing or logic. */
export default function CleanWorldPreview({ params }: { params: { scene: string } }) {
  if (!/^[0-3]$/.test(params.scene)) notFound();
  return <main style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", overflow: "hidden", background: "#f7f5ea" }}>
    <div style={{ width: "min(100vw, 177.7777778dvh)" }}>
      <StageWorld scene={Number(params.scene) as SceneIndex} />
    </div>
  </main>;
}
