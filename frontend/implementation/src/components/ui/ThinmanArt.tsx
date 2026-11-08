/**
 * Thinman as he is in the game (Character A: sketchy figure, oval head with eyes, thin body), rendered from the
 * same generator the game rig uses. Intro and tutorial use this so he never turns into a plain stick figure.
 * The markup comes from our own pure generator (no user data).
 */
import { renderCharacterAFrontSvg, renderCharacterASideSvg } from "@/src/game/character/character-a-svg";
import { POSES, type PoseAngles } from "@/src/game/character/character-rig-constants";

export type ThinmanPose = "stand" | "walkA" | "walkB" | "hop" | "ouch";

const SIDE: Record<Exclude<ThinmanPose, "stand" | "ouch">, PoseAngles> = {
  walkA: [-32, 38, 26, 10, 32, -36, 0],
  walkB: [26, 10, -32, 38, -36, 32, 0],
  hop: POSES.APEX,
};

export function ThinmanArt({ pose = "stand", className, style }: { pose?: ThinmanPose; className?: string; style?: React.CSSProperties }) {
  const html = pose === "stand" || pose === "ouch" ? renderCharacterAFrontSvg() : renderCharacterASideSvg(SIDE[pose], pose === "hop" ? 1 : 0);
  return <span className={`thinman-art${className ? " " + className : ""}`} style={style} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}
