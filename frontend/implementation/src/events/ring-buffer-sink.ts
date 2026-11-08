import type { EnvelopedEvent, EnvelopedEventSink } from "../domain/events";

/** In-memory ring buffer (newest `capacity` events) for unit tests and E2E assertions. */
export class RingBufferSink implements EnvelopedEventSink {
  private items: EnvelopedEvent[] = [];
  private overwritten = 0;

  constructor(private readonly capacity = 200) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError("capacity must be a positive integer");
  }

  write(event: EnvelopedEvent): void {
    this.items.push(event);
    if (this.items.length > this.capacity) {
      this.items.shift();
      this.overwritten++;
    }
  }

  /** Copy of the buffered events, oldest first. */
  snapshot(): EnvelopedEvent[] {
    return [...this.items];
  }

  get size(): number {
    return this.items.length;
  }

  /** How many old events were evicted because the buffer was full. */
  get evicted(): number {
    return this.overwritten;
  }

  last(): EnvelopedEvent | undefined {
    return this.items[this.items.length - 1];
  }

  clear(): void {
    this.items = [];
    this.overwritten = 0;
  }
}
