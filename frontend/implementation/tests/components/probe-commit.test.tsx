import {afterEach,describe,it,expect,vi} from "vitest";
import {render,screen,fireEvent,cleanup} from "@testing-library/react";
import {DecisionPanel} from "@/src/components/decision/DecisionPanel";
import {LEVELS} from "@/src/domain/levels";
afterEach(cleanup);
const prediction={candidates:[{label:"papan",confidence:.6},{label:"batu",confidence:.3},{label:"tangga",confidence:.1}]} as const;
function setup(){const onAccept=vi.fn(),onCorrect=vi.fn(),onOverride=vi.fn();render(<DecisionPanel prediction={{candidates:[...prediction.candidates]}} level={{...LEVELS[0]!,vocabulary:["papan","batu","tangga","balok"]}} onAccept={onAccept} onCorrect={onCorrect} onOverride={onOverride} onRedraw={vi.fn()}/>);return {onAccept,onCorrect,onOverride};}
describe("PROBE requires one explicit commit",()=>{
it("Correct selection does not commit before CTA",()=>{const {onCorrect}=setup();fireEvent.click(screen.getByText(/Correct —/));fireEvent.click(screen.getByText(/#2 ·/));expect(onCorrect).not.toHaveBeenCalled();fireEvent.click(screen.getByTestId("btn-wujudkan-objek"));expect(onCorrect).toHaveBeenCalledTimes(1);expect(onCorrect).toHaveBeenCalledWith(2);});
it("Override selection does not commit before CTA",()=>{const {onOverride}=setup();fireEvent.click(screen.getByText(/Override —/));fireEvent.change(screen.getByLabelText("Label yang dimaksud:"),{target:{value:"balok"}});fireEvent.click(screen.getByTestId("override-confirm"));expect(onOverride).not.toHaveBeenCalled();fireEvent.click(screen.getByTestId("btn-wujudkan-objek"));expect(onOverride).toHaveBeenCalledTimes(1);expect(onOverride).toHaveBeenCalledWith("balok");});
it("double commit emits one Accept",()=>{const {onAccept}=setup();fireEvent.click(screen.getByText(/Accept —/));fireEvent.click(screen.getByTestId("btn-wujudkan-objek"));fireEvent.click(screen.getByTestId("btn-wujudkan-objek"));expect(onAccept).toHaveBeenCalledTimes(1);});
});
