import { describe, expect, it, vi } from "vitest";
import { attachPointerDriver } from "@/src/input/pointer-input";
import { StrokeStore } from "@/src/input/types";

function pointerEvent(type: string, values: Record<string, unknown>): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  for (const [key, value] of Object.entries(values)) Object.defineProperty(event, key, { configurable: true, value });
  return event;
}

describe("pointer input", () => {
  it("lets the primary pointer own the stroke, ignores right-clicks, clamps coordinates, and responds to coalesced velocity", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 200; canvas.height = 100;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 10, y: 20, top: 20, left: 10, right: 110, bottom: 70, width: 100, height: 50, toJSON: () => ({}),
    });
    const store = new StrokeStore();
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const detach = attachPointerDriver(canvas, store, vi.fn(), { onStart, onEnd });

    canvas.dispatchEvent(pointerEvent("pointerdown", { pointerId: 9, button: 2, isPrimary: true, clientX: 20, clientY: 30, timeStamp: 0 }));
    canvas.dispatchEvent(pointerEvent("pointerdown", { pointerId: 1, button: 0, isPrimary: true, clientX: -20, clientY: 100, timeStamp: 0 }));
    canvas.dispatchEvent(pointerEvent("pointerdown", { pointerId: 2, button: 0, isPrimary: true, clientX: 60, clientY: 40, timeStamp: 1 }));
    const slow = pointerEvent("pointermove", { pointerId: 1, button: 0, isPrimary: true, clientX: 15, clientY: 45, timeStamp: 50 }) as PointerEvent;
    const fast = pointerEvent("pointermove", { pointerId: 1, button: 0, isPrimary: true, clientX: 65, clientY: 45, timeStamp: 60 }) as PointerEvent;
    const move = pointerEvent("pointermove", { pointerId: 1, button: 0, isPrimary: true, clientX: 65, clientY: 45, timeStamp: 60, getCoalescedEvents: () => [slow, fast] });
    canvas.dispatchEvent(move);
    canvas.dispatchEvent(pointerEvent("pointerup", { pointerId: 1, button: 0, isPrimary: true, clientX: 65, clientY: 45, timeStamp: 100 }));

    const stroke = store.getStrokes().completed[0]!;
    expect(onStart).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledOnce();
    expect(stroke[0]).toMatchObject({ x: 0, y: 100, width: 12, opacity: 1 });
    expect(stroke).toHaveLength(3);
    expect(stroke[1]!.width).toBeGreaterThan(stroke[2]!.width!);
    expect(stroke[1]!.opacity).toBeGreaterThan(stroke[2]!.opacity!);
    detach();
  });
});
