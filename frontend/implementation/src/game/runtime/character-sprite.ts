/**
 * Character A (the Thinman rig) sprites for the integrated scene: loads every keyframe, attaches
 * the right sprite to the player once loaded (with the legacy stickman as fallback), and swaps the
 * keyframe / facing each fixed step from the animation bridge.
 */
import type { GameObj, KAPLAYCtx, PosComp, SpriteComp } from "kaplay";
import { STICKMAN_ASSET, stickmanSvg } from "../assets/stickman-svg";
import { kaplayAssetToPromise, recoverCharacterSpriteLoad } from "../character/character-load-recovery";
import { buildCharacterAKeyframeManifest, type CharacterRuntimeBridge } from "../character/character-runtime-bridge";
import { CHARACTER_VISUAL_SCALE, PLAYER_HEIGHT, PLAYER_WIDTH } from "./constants";
import type { PlayerObject } from "./world-setup";

/** Rig texture oversampling: sprites are rasterised 8x and scaled back down. */
const TEXTURE_SCALE = 8;

interface CharacterSpriteOptions {
  k: KAPLAYCtx;
  canvas: HTMLCanvasElement;
  player: PlayerObject;
  bridge: CharacterRuntimeBridge;
  stage: number;
  /** Source-art -> world scale of the stage (used to size the sprite from the collider). */
  sceneScale: number;
  isDestroyed: () => boolean;
}

export class CharacterSpriteLayer {
  private readonly k: KAPLAYCtx;
  private readonly bridge: CharacterRuntimeBridge;
  private readonly frameSprites: Map<string, string>;
  private sprite: GameObj<PosComp & SpriteComp> | null = null;

  constructor({ k, canvas, player, bridge, stage, sceneScale, isDestroyed }: CharacterSpriteOptions) {
    this.k = k;
    this.bridge = bridge;
    const svg = stickmanSvg().replace(
      /width="[^"]+" height="[^"]+"/,
      `width="${STICKMAN_ASSET.width * TEXTURE_SCALE}" height="${STICKMAN_ASSET.height * TEXTURE_SCALE}"`,
    );
    const legacySpriteName = `integrated-stickman-${stage}`;
    const legacyAsset = k.loadSprite(
      legacySpriteName,
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    );
    const manifest = buildCharacterAKeyframeManifest(TEXTURE_SCALE);
    this.frameSprites = new Map(
      manifest.map((frame) => [frame.frameId, `integrated-character-${stage}-${frame.frameId}`]),
    );
    const frameLoads = manifest.map((frame) => k.loadSprite(this.frameSprites.get(frame.frameId)!, frame.dataUri));
    const transform = bridge.computeVisualTransform({
      colliderWidth: PLAYER_WIDTH,
      colliderHeight: PLAYER_HEIGHT,
      sceneScale,
      textureScale: TEXTURE_SCALE,
      visualScale: CHARACTER_VISUAL_SCALE,
    });

    void recoverCharacterSpriteLoad(
      kaplayAssetToPromise(legacyAsset).then(() => undefined),
      Promise.all(frameLoads.map((asset) => kaplayAssetToPromise(asset).then(() => undefined))),
    )
      .then((characterLoaded) => {
        if (isDestroyed() || !player?.exists?.() || !player.pos) return;
        if (characterLoaded) {
          // Character A is a 208x391 rig: size it from the collider (feet on body bottom), not the 24x48 legacy stickman.
          this.sprite = player.add([
            k.sprite(this.frameSprites.get(bridge.getCurrentFrameId())!),
            k.pos(transform.offsetX, transform.offsetY),
            k.scale(transform.scale),
          ]);
          canvas.dataset.characterRenderer = "character-a";
          canvas.dataset.characterRenderHeight = String(transform.spriteHeight * transform.scale);
        } else {
          canvas.dataset.characterRenderer = "legacy-fallback";
          this.sprite = player.add([
            k.sprite(legacySpriteName),
            k.pos(
              PLAYER_WIDTH / 2 - STICKMAN_ASSET.foot.x * sceneScale,
              PLAYER_HEIGHT - STICKMAN_ASSET.foot.y * sceneScale,
            ),
            k.scale(sceneScale / TEXTURE_SCALE),
          ]);
        }
      })
      .catch((error) => {
        if (isDestroyed()) return;
        canvas.dataset.characterLoadError = error instanceof Error ? error.message : String(error);
        console.error("Character A and legacy fallback sprite load failed", error);
      });
  }

  /** Show the keyframe and facing the animation bridge currently reports. */
  syncFromBridge(): void {
    const nextFrameSprite = this.frameSprites.get(this.bridge.getCurrentFrameId());
    if (this.sprite?.exists?.()) {
      if (nextFrameSprite) this.sprite.sprite = nextFrameSprite;
      this.sprite.flipX = this.bridge.getFacing() === -1;
    }
  }
}
