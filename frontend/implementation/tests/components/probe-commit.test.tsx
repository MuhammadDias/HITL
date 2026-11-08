import {afterEach,describe,it,expect,vi} from "vitest";
import {render,screen,fireEvent,cleanup} from "@testing-library/react";
import {DecisionPanel} from "@/src/components/decision/DecisionPanel";
import {LEVELS} from "@/src/domain/levels";
afterEach(cleanup);
const prediction={candidates:[{label:"papan",confidence:.6},{label:"batu",confidence:.3},{label:"tangga",confidence:.1}]} as const;
function setup(){const onAccept=vi.fn(),onCorrect=vi.fn(),onOverride=vi.fn();render(<DecisionPanel prediction={{candidates:[...prediction.candidates]}} level={{...LEVELS[0]!,vocabulary:["papan","batu","tangga","balok"]}} onAccept={onAccept} onCorrect={onCorrect} onOverride={onOverride} onRedraw={vi.fn()}/>);return {onAccept,onCorrect,onOverride};}
describe("Decision commits exactly once, on the decisive tap",()=>{
it("Correct: opening the picker does not commit; tapping a rank commits exactly once",()=>{const {onCorrect}=setup();fireEvent.click(screen.getByTestId("btn-correct"));expect(onCorrect).not.toHaveBeenCalled();const pick=()=>document.querySelector('.correct-option[data-rank="2"]') as HTMLElement;fireEvent.click(pick());fireEvent.click(pick());expect(onCorrect).toHaveBeenCalledTimes(1);expect(onCorrect).toHaveBeenCalledWith(2);});
it("Override: choosing a label alone does not commit; confirming commits",()=>{const {onOverride}=setup();fireEvent.click(screen.getByTestId("btn-override"));fireEvent.change(document.getElementById("override-select") as HTMLSelectElement,{target:{value:"balok"}});expect(onOverride).not.toHaveBeenCalled();fireEvent.click(screen.getByTestId("override-confirm"));expect(onOverride).toHaveBeenCalledTimes(1);expect(onOverride).toHaveBeenCalledWith("balok");});
it("double tap emits one Accept",()=>{const {onAccept}=setup();fireEvent.click(screen.getByTestId("btn-accept"));fireEvent.click(screen.getByTestId("btn-accept"));expect(onAccept).toHaveBeenCalledTimes(1);});
});
