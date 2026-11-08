/**
 * Single place that builds a MediaPipe HandLandmarker.
 *
 * Delegate policy: try GPU first; if createFromOptions rejects (no WebGL2,
 * blocked GPU on school PCs, driver bug) retry ONCE on CPU. The chosen
 * delegate is returned so callers can surface it in status text.
 * If CPU also fails the CPU error is thrown (the model/wasm itself is bad).
 */
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

export type HandDelegate = "GPU" | "CPU";

export interface CreateHandLandmarkerOptions {
  wasmRoot: string;
  modelUrl: string;
  numHands?: number;
}

export interface CreatedHandLandmarker {
  landmarker: HandLandmarker;
  delegate: HandDelegate;
  /** True when GPU failed and CPU was used instead. */
  fellBack: boolean;
}

export async function createHandLandmarker(
  options: CreateHandLandmarkerOptions,
): Promise<CreatedHandLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(options.wasmRoot);
  const build = (delegate: HandDelegate) =>
    HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: options.modelUrl, delegate },
      runningMode: "VIDEO",
      numHands: options.numHands ?? 1,
    });
  try {
    return { landmarker: await build("GPU"), delegate: "GPU", fellBack: false };
  } catch {
    return { landmarker: await build("CPU"), delegate: "CPU", fellBack: true };
  }
}

/** Short diagnostic suffix, e.g. "GPU" or "CPU (cadangan)". */
export function delegateLabel(created: Pick<CreatedHandLandmarker, "delegate" | "fellBack">): string {
  return created.fellBack ? `${created.delegate} (cadangan)` : created.delegate;
}
