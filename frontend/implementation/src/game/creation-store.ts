import type { DrawingInput, ObjectBehavior } from "../domain/types";

/** A committed drawing in world coordinates; pending drawings are not stored. */
export interface WorldCreation {
  id: string;
  label: string;
  behavior: ObjectBehavior;
  drawingInput: DrawingInput | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

function copyCreation(item: WorldCreation): WorldCreation {
  return {
    ...item,
    drawingInput: item.drawingInput ? {
      ...item.drawingInput,
      strokes: item.drawingInput.strokes.map(stroke => stroke.map(point => ({ ...point }))),
    } : null,
  };
}

/** App-owned prototype memory. No quota; every level entry starts a fresh world. */
export class CreationStore {
  levelId: string | null = null;
  private readonly items = new Map<string, WorldCreation>();

  /** Explicit entry includes restarting the same level, not drawing another object. */
  enterLevel(levelId: string): void {
    this.levelId = levelId;
    this.clear();
  }

  upsert(item: WorldCreation): void {
    this.items.set(item.id, copyCreation(item));
  }

  remove(id: string): void {
    this.items.delete(id);
  }

  /** Replace the committed runtime snapshot without retaining caller-owned data. */
  replace(items: WorldCreation[]): void {
    this.clear();
    for (const item of items) this.upsert(item);
  }

  snapshot(): WorldCreation[] {
    return [...this.items.values()].map(copyCreation);
  }

  clear(): void {
    this.items.clear();
  }
}
