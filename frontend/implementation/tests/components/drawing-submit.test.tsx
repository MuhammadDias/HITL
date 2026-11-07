import {afterEach,it,expect,vi} from "vitest";
import {render,screen,cleanup} from "@testing-library/react";
import {DrawingScreen} from "@/src/components/drawing/DrawingScreen";
import {LEVELS} from "@/src/domain/levels";
vi.mock("@/src/input",()=>({DrawingSurface:class {resizeForDpr(){} dispose(){} setMode(){return Promise.resolve();}}}));
afterEach(cleanup);
it("shows explicit disabled prediction submit before ink and no placeholder catalog",()=>{render(<DrawingScreen level={LEVELS[0]!} initialMode="pointer" feedback={null} surfaceOut={{current:null}} onSubmit={vi.fn()} onExit={vi.fn()}/>);expect(screen.getByTestId("btn-submit-drawing").hasAttribute("disabled")).toBe(true);expect(screen.queryByText(/Katalog DEMO/)).toBeNull();expect(screen.queryByLabelText("Tebakan AI")).toBeNull();});
