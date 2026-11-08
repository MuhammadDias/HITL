import {it,expect,vi,afterEach} from 'vitest';
import {render,cleanup} from '@testing-library/react';
import {GameStage} from '@/src/components/game/GameStage';
import {LEVELS} from '@/src/domain/levels';
vi.mock('@/src/game/game-controller',()=>({GameController:class{mount=vi.fn().mockResolvedValue(undefined);unmount=vi.fn();setInput=vi.fn();}}));
afterEach(cleanup);
it('composes one clean world with interactive canvas and a single draw-again control',()=>{
 const {container}=render(<GameStage integrated level={LEVELS[0]!} behavior="solid" decision={{type:'accept',finalLabel:'papan',sourceRank:1}} drawingInput={null} phase="gameplay" onOutcomeReported={()=>{}} onRedraw={()=>{}} onFallComplete={()=>{}} onCommitPlacement={()=>{}} onReposition={()=>{}} onCreateAnotherObject={()=>{}}/>);
 expect(container.querySelector('[data-testid="stage-world"]')).not.toBeNull();
 expect(container.querySelector('[data-asset-role="character-preview"]')).toBeNull();
 expect(container.querySelectorAll('canvas')).toHaveLength(1);
 // One "draw again" control (no separate redraw / create-another buttons)
 expect(container.querySelector('[data-testid="btn-draw-again"]')).not.toBeNull();
 expect(container.querySelector('[data-testid="btn-create-object"]')).toBeNull();
});
