export type SubscriptionListener<Value> = (value: Value) => void;

export class SubscriptionStore<Value> {
  private readonly listeners = new Map<number, SubscriptionListener<Value>>();
  private queue: Value[] = [];
  private nextId = 1;
  private publishing = false;
  private disposed = false;

  subscribe(listener: SubscriptionListener<Value>): () => void {
    if (this.disposed) throw new Error('Subscription store is disposed');
    const id = this.nextId;
    this.nextId += 1;
    this.listeners.set(id, listener);
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.listeners.delete(id);
    };
  }

  publish(value: Value): void {
    this.queue.push(value);
    if (this.publishing) return;

    this.publishing = true;
    let firstError: unknown;
    let hasError = false;
    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift() as Value;
        const current = [...this.listeners.entries()];
        for (const [id, listener] of current) {
          if (this.listeners.get(id) !== listener) continue;
          try {
            listener(next);
          } catch (error) {
            if (!hasError) {
              hasError = true;
              firstError = error;
            }
          }
        }
      }
    } finally {
      this.publishing = false;
    }

    if (hasError) throw firstError;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.listeners.clear();
    this.queue = [];
  }
}
