import { beforeEach, describe, expect, it, vi } from "vitest";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { createHandLandmarker, delegateLabel } from "@/src/camera/hand-landmarker";

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: vi.fn() },
  HandLandmarker: { createFromOptions: vi.fn() },
}));

const create = vi.mocked(HandLandmarker.createFromOptions);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as never);
});

const opts = { wasmRoot: "/w", modelUrl: "/m.task" };
const delegateOf = (call: number) =>
  ((create.mock.calls[call]![1] as { baseOptions: { delegate: string } }).baseOptions.delegate);

describe("createHandLandmarker delegate policy", () => {
  it("uses GPU when it works and does not touch CPU", async () => {
    create.mockResolvedValueOnce({ id: "gpu" } as never);
    const r = await createHandLandmarker(opts);
    expect(r.delegate).toBe("GPU");
    expect(r.fellBack).toBe(false);
    expect(create).toHaveBeenCalledTimes(1);
    expect(delegateOf(0)).toBe("GPU");
    expect(delegateLabel(r)).toBe("GPU");
  });

  it("retries ONCE on CPU when GPU createFromOptions rejects, and reports CPU", async () => {
    create.mockRejectedValueOnce(new Error("WebGL2 unavailable")).mockResolvedValueOnce({ id: "cpu" } as never);
    const r = await createHandLandmarker(opts);
    expect(create).toHaveBeenCalledTimes(2);
    expect([delegateOf(0), delegateOf(1)]).toEqual(["GPU", "CPU"]);
    expect(r.delegate).toBe("CPU");
    expect(r.fellBack).toBe(true);
    expect(delegateLabel(r)).toBe("CPU (cadangan)");
  });

  it("does not loop forever: GPU and CPU both failing throws after exactly two attempts", async () => {
    create.mockRejectedValue(new Error("model 404"));
    await expect(createHandLandmarker(opts)).rejects.toThrow("model 404");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("resolves the wasm fileset only once for the retry", async () => {
    create.mockRejectedValueOnce(new Error("gpu")).mockResolvedValueOnce({} as never);
    await createHandLandmarker(opts);
    expect(FilesetResolver.forVisionTasks).toHaveBeenCalledTimes(1);
  });
});
