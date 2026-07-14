export type SubscriptionListener<Value> = (value: Value) => void;

export class SubscriptionStore<Value> {
  private readonly listeners = new Map<number, SubscriptionListener<Value>>();
  private nextId = 1;
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
    const current = [...this.listeners.entries()];
    for (const [id, listener] of current) {
      if (this.listeners.get(id) === listener) listener(value);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.listeners.clear();
  }
}
