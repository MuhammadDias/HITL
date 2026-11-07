import { useId } from 'react';
import { STICKMAN_DEFINITION } from '../../game/assets/stickman-svg';
import { StageAtmosphere } from './StageAtmosphere';
import { STAGE_SCENES, type SceneIndex } from './scene-metadata';

interface StageArtworkProps {
  scene: SceneIndex;
  className?: string;
  gameplay?: boolean;
}

function ArtworkDefinitions({ prefix }: { prefix: string }) {
  return (
    <defs>
      <filter id={`${prefix}-rough`}>
        <feTurbulence type="fractalNoise" baseFrequency=".075" numOctaves="1" seed="4" />
        <feDisplacementMap in="SourceGraphic" scale="0.7" />
      </filter>
      <pattern id={`${prefix}-dirt`} width="46" height="46" patternUnits="userSpaceOnUse">
        <rect width="46" height="46" fill="#a9733f" />
        <path d="M0 12q11-7 23 0t23 0M0 34q11-7 23 0t23 0" stroke="#7e5128" strokeWidth="1.3" fill="none" opacity=".55" />
        <path d="M8 22l5 3M30 4l4 3M36 40l5-2" stroke="#c28f58" strokeWidth="2" opacity=".6" />
        <path d="M6 9l8 -3M22 20l11 -5M3 37l7 -3M37 24l7 -3" stroke="#543e2b" strokeWidth=".9" strokeLinecap="round" opacity=".22" />
        <circle cx="26" cy="10" r="1" fill="#f1ddba" opacity=".45" />
        <circle cx="13" cy="30" r="1.2" fill="#563d29" opacity=".24" />
      </pattern>
      <pattern id={`${prefix}-spk`} width="22" height="46" patternUnits="userSpaceOnUse">
        <path d="M1 46L11 12L21 46Z" fill="#cfcabb" stroke="#1e2126" strokeWidth="1.6" />
      </pattern>
      <g id={`${prefix}-man`} fill={STICKMAN_DEFINITION.fill} stroke={STICKMAN_DEFINITION.stroke} strokeWidth={STICKMAN_DEFINITION.strokeWidth} strokeLinecap={STICKMAN_DEFINITION.strokeLinecap}>
        <circle {...STICKMAN_DEFINITION.circle} />
        <path d={STICKMAN_DEFINITION.path} />
      </g>
      <g id={`${prefix}-flag`}>
        <path d="M0 0V-52" stroke="#1e2126" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M1-52L30-42L1-34Z" fill="#df6930" stroke="#1e2126" strokeWidth="2" strokeLinejoin="round" />
      </g>
      <g id={`${prefix}-spark`} stroke="#df6930" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M0 0l-5-11M9 3l4-10M15 10l10-4" />
      </g>
      <g id={`${prefix}-cam`}>
        <rect width="108" height="88" rx="16" fill="#000" stroke="#df6930" strokeWidth="4" />
      </g>
      <g id={`${prefix}-cloud`} fill="#fcf9ef" stroke="#aaa99f" strokeWidth="1.8" strokeLinecap="round">
        <path d="M0 40q-8-24 22-26q8-22 38-12q24-8 34 14q22 4 14 24z" />
        <path d="M12 30q18-6 30 0M50 26q16-6 30 2" fill="none" opacity=".7" />
        <path d="M14 38l8 -4M30 40l8 -5M60 36l8 -5M84 37l7 -4" fill="none" stroke="#a8a59e" strokeWidth=".9" opacity=".52" strokeLinecap="round" />
      </g>
      <g id={`${prefix}-city`} fill="#d6d3c8" opacity=".42">
        <path d="M0 325V230h26v-40h30v60h22v-90h34v110h26v-60h30v100h30v-70h40v90z" />
      </g>
      <g id={`${prefix}-paper`} fill="#f3ead2" stroke="#b9ab86" strokeWidth="1.4">
        <path d="M0 0l22-3 4 24-22 5z" />
      </g>
    </defs>
  );
}

function SceneLayers({ scene, prefix, gameplay }: { scene: SceneIndex; prefix: string; gameplay: boolean }) {
  switch (scene) {
    case 0:
      return (
        <>
        <StageAtmosphere scene={scene} prefix={prefix} />
        <g stroke="#1e2126" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <circle cx="650" cy="62" r="17" />
          <path d="M650 30v-8M650 94v8M618 62h-8M690 62h8M628 40l-6-6M672 84l6 6M672 40l6-6M628 84l-6 6" strokeWidth="2" />
        </g>
        <g filter={`url(#${prefix}-rough)`} stroke="#1e2126" strokeWidth="2.6" strokeLinejoin="round">
          <path d="M200 400l36-52l-8 80l6 108H196z" fill="#e5cfa0" strokeWidth="1.8" />
          <path d="M552 400l-30-62l14 70l-8 128h40z" fill="#e5cfa0" strokeWidth="1.8" />
          <path d="M196 340h-4v196h14z" fill="#d9bd88" stroke="none" />
          <path d="M0 340h196v110l-6 86H0z" fill={`url(#${prefix}-dirt)`} />
          <path d="M556 340h196v196H560l-4-90z" fill={`url(#${prefix}-dirt)`} />
          <path d="M0 336h196v16H0zM556 336h196v16H556z" fill="#7ea142" />
          <path d="M0 336h196M556 336h196" stroke="#4d6a24" strokeWidth="3" />
        </g>
        <g fill="none" stroke="#8a867b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".9">
          <path d="M220 536l14-34l24-8l12 42M250 510l10-46l22 8-4 38M300 536l8-26l30-10l6 36M345 518l4-40h20l6 40M380 536l10-30l28 6l8 24M430 520l6-50l12-4l6 54M470 536l22-26l30 8M505 520l14-24l20 40M240 536l30-22M330 536l30-16" />
          <path d="M200 536h350" stroke="#555" strokeWidth="3" />
        </g>
        {!gameplay && <use data-asset-role="character-preview" href={`#${prefix}-man`} transform="translate(116 334) scale(1.75)" />}
        <use data-asset-role="goal-preview" href={`#${prefix}-flag`} transform="translate(668 334) scale(1.5)" />
        <use href={`#${prefix}-spark`} transform="translate(150 232) rotate(-20) scale(.9)" />
        <use href={`#${prefix}-spark`} transform="translate(722 252) scale(.9)" />
        <use href={`#${prefix}-spark`} transform="translate(700 302) rotate(20) scale(.7)" />
        <use href={`#${prefix}-cam`} transform="translate(22 428)" />
        </>
      );
    case 1:
      return (
        <>
        <use href={`#${prefix}-city`} />
        <StageAtmosphere scene={scene} prefix={prefix} />
        <g filter={`url(#${prefix}-rough)`} stroke="#1e2126" strokeWidth="2.4" strokeLinejoin="round">
          <path d="M152 204l60-38l-20 160h-44z" fill="#e8d5a6" strokeWidth="1.6" />
          <path d="M360 204l-40-36l24 158h20z" fill="#e8d5a6" strokeWidth="1.6" />
          <path d="M0 204h152v121H0z" fill={`url(#${prefix}-dirt)`} />
          <path d="M360 200h130v125H356z" fill={`url(#${prefix}-dirt)`} />
          <path d="M0 196h154v15H0zM358 192h132v15H358z" fill="#7ea142" />
        </g>
        <g fill="none" stroke="#8a867b" strokeWidth="1.6" strokeLinecap="round">
          <path d="M170 325l12-34l22-10l10 44M205 306l14-28l20 6l6 36M235 325l24-30l24 6l8 24M290 318l10-24l22 14" />
        </g>
        {!gameplay && <use data-asset-role="character-preview" href={`#${prefix}-man`} transform="translate(42 198) scale(1.1)" />}
        <use data-asset-role="goal-preview" href={`#${prefix}-flag`} transform="translate(458 192)" />
        </>
      );
    case 2:
      return (
        <>
        <use href={`#${prefix}-city`} transform="translate(10 0)" />
        <StageAtmosphere scene={scene} prefix={prefix} />
        <g filter={`url(#${prefix}-rough)`} stroke="#1e2126" strokeWidth="2.4" strokeLinejoin="round">
          <rect x="44" y="196" width="66" height="129" fill="#c9a577" />
          <rect x="40" y="190" width="74" height="12" fill="#8c6a41" />
          <rect x="150" y="136" width="66" height="189" fill="#d2b186" />
          <rect x="146" y="130" width="74" height="10" fill="#9b7a4e" />
          <rect x="170" y="116" width="28" height="16" fill="#7ea142" />
          <rect x="166" y="130" width="36" height="6" fill="#8c6a41" />
          <rect x="340" y="136" width="82" height="189" fill="#b98b5a" />
          <rect x="334" y="130" width="94" height="10" fill="#7c5a33" />
          <path d="M330 130L378 62l54 68z" fill="#c9bfa5" />
          <path d="M378 62l54 68h-30z" fill="#aaa086" stroke="none" />
          <rect x="82" y="262" width="58" height="9" fill="#a9733f" />
          <rect x="258" y="190" width="52" height="9" fill="#a9733f" />
          <rect x="300" y="86" width="56" height="9" fill="#a9733f" />
          <path d="M406 148l10 4l-4 40l-14-4z" fill="#f3ead2" strokeWidth="1.5" />
        </g>
        <g stroke="#1e2126" strokeWidth="2.4" fill="none">
          <path d="M349 140V325M366 140V325M349 162h17M349 186h17M349 210h17M349 234h17M349 258h17M349 282h17M349 306h17" />
        </g>
        {!gameplay && <use data-asset-role="character-preview" href={`#${prefix}-man`} transform="translate(77 190) scale(1.1)" />}
        <use data-asset-role="goal-preview" href={`#${prefix}-flag`} transform="translate(379 66) scale(.75)" />
        </>
      );
    case 3:
      return (
        <>
        <use href={`#${prefix}-city`} />
        <StageAtmosphere scene={scene} prefix={prefix} />
        <g filter={`url(#${prefix}-rough)`} stroke="#1e2126" strokeWidth="2.4" strokeLinejoin="round">
          <path d="M0 206h128v119H0z" fill={`url(#${prefix}-dirt)`} />
          <path d="M366 168h124v157H368z" fill={`url(#${prefix}-dirt)`} />
          <path d="M0 198h130v15H0zM362 160h128v15H362z" fill="#7ea142" />
          <rect x="130" y="278" width="238" height="47" fill="#df6930" />
          <rect x="184" y="238" width="66" height="54" fill="#a39d90" />
          <path d="M196 238l8-12l10 8l8-10l8 12z" fill="#c9a24b" strokeWidth="1.6" />
          <rect x="204" y="150" width="76" height="9" fill="#a9733f" />
          <rect x="304" y="212" width="52" height="9" fill="#a9733f" />
          <path d="M18 250l22-4l6 26l-22 5zM428 214l26-6l8 28l-26 6z" fill="#f3ead2" strokeWidth="1.4" />
        </g>
        <rect x="132" y="282" width="236" height="43" fill={`url(#${prefix}-spk)`} />
        {!gameplay && <use data-asset-role="character-preview" href={`#${prefix}-man`} transform="translate(48 198) scale(1.1)" />}
        <use data-asset-role="goal-preview" href={`#${prefix}-flag`} transform="translate(436 160)" />
        </>
      );
  }
}

/** Inline vector port; useId scopes every definition and reference per mount. */
export function StageArtwork({ scene, className, gameplay = false }: StageArtworkProps) {
  const id = useId();
  const prefix = `stage-${id.replace(/[^a-zA-Z0-9_-]/g, (character) => `_${character.codePointAt(0)!.toString(16)}_`)}`;
  const title = STAGE_SCENES[scene].title;

  return (
    <svg
      className={['art-svg', className].filter(Boolean).join(' ')}
      preserveAspectRatio="xMidYMid slice"
      viewBox={scene === 0 ? '0 0 752 536' : '0 0 490 325'}
      role="img"
      aria-label={title}
    >
      <title id={`${prefix}-title`}>{title}</title>
      <ArtworkDefinitions prefix={prefix} />
      <SceneLayers scene={scene} prefix={prefix} gameplay={gameplay} />
    </svg>
  );
}
