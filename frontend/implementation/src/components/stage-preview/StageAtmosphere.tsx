import type { SceneIndex } from './scene-metadata';

interface StageAtmosphereProps {
  scene: SceneIndex;
  prefix: string;
}

/** Decorative layers retain their original order, geometry and motion classes. */
export function StageAtmosphere({ scene, prefix }: StageAtmosphereProps) {
  switch (scene) {
    case 0:
      return (
        <>
        <g className="cloud-motion cloud-near" data-layer="clouds" aria-hidden="true">
          <use href={`#${prefix}-cloud`} transform="translate(10 34) scale(1.1)" opacity=".8" />
        </g>
        <g className="cloud-motion cloud-far" data-layer="clouds" aria-hidden="true">
          <use href={`#${prefix}-cloud`} transform="translate(630 96) scale(1.1)" opacity=".8" />
        </g>
        </>
      );
    case 1:
      return (
        <>
        <g className="cloud-motion cloud-mid" data-layer="clouds" aria-hidden="true">
          <use href={`#${prefix}-cloud`} transform="translate(10 12)" opacity=".7" />
        </g>
        <g className="cloud-motion cloud-near" data-layer="clouds" aria-hidden="true">
          <use href={`#${prefix}-cloud`} transform="translate(330 76) scale(.7)" opacity=".7" />
        </g>
        </>
      );
    case 2:
      return (
        <>
        <g className="cloud-motion cloud-far" data-layer="clouds" aria-hidden="true">
          <use href={`#${prefix}-cloud`} transform="translate(340 60) scale(.8)" opacity=".6" />
        </g>
        </>
      );
    case 3:
      return (
        <>
        <g className="fog-motion" data-layer="fog" fill="#3a3a3c" opacity=".92">
          <circle cx="440" cy="26" r="40" />
          <circle cx="395" cy="20" r="30" />
          <circle cx="470" cy="76" r="28" />
          <circle cx="420" cy="70" r="22" />
        </g>
        <g className="mist-motion" data-layer="mist" fill="#8a867b" opacity=".5">
          <circle cx="160" cy="140" r="30" />
          <circle cx="195" cy="120" r="24" />
        </g>
        </>
      );
  }
}
