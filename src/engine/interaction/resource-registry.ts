export interface EventTargetPort {
  addEventListener(type: string, listener: (event: unknown) => void, options?: unknown): void;
  removeEventListener(type: string, listener: (event: unknown) => void, options?: unknown): void;
}

interface ResourceEntry {
  active: boolean;
  readonly dispose: () => void;
}

function disposeListener(
  target: EventTargetPort,
  type: string,
  listener: (event: unknown) => void,
  options: unknown,
  afterRemove: (() => void) | undefined,
): void {
  const errors: unknown[] = [];
  try {
    target.removeEventListener(type, listener, options);
  } catch (error) {
    errors.push(error);
  }
  try {
    afterRemove?.();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'Failed to remove event listener');
}

export class ResourceRegistry {
  private readonly entries: ResourceEntry[] = [];
  private disposed = false;

  get active(): boolean {
    return !this.disposed;
  }

  own(disposer: () => void): () => void {
    if (this.disposed) {
      disposer();
      return () => {};
    }
    const entry: ResourceEntry = { active: true, dispose: disposer };
    this.entries.push(entry);
    return () => this.release(entry);
  }

  observer(disconnect: () => void): () => void {
    return this.own(disconnect);
  }

  timer(cancel: () => void): () => void {
    return this.own(cancel);
  }

  animationFrame(cancel: () => void): () => void {
    return this.own(cancel);
  }

  subscription(unsubscribe: () => void): () => void {
    return this.own(unsubscribe);
  }

  overlay(remove: () => void): () => void {
    return this.own(remove);
  }

  listen(
    target: EventTargetPort,
    type: string,
    listener: (event: unknown) => void,
    options?: unknown,
    afterRemove?: () => void,
  ): () => void {
    const guarded = this.guard(listener);
    try {
      target.addEventListener(type, guarded, options);
    } catch (cause) {
      try {
        disposeListener(target, type, guarded, options, afterRemove);
      } catch (cleanup) {
        throw new AggregateError([cause, cleanup], 'Failed to add event listener', { cause });
      }
      throw cause;
    }
    return this.own(() => disposeListener(target, type, guarded, options, afterRemove));
  }

  guard<Args extends readonly unknown[]>(callback: (...args: Args) => void): (...args: Args) => void {
    return (...args: Args): void => {
      if (!this.disposed) callback(...args);
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const errors: unknown[] = [];
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const entry = this.entries[index]!;
      if (!entry.active) continue;
      entry.active = false;
      try {
        entry.dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    this.entries.length = 0;
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Failed to dispose browser resources');
    }
  }

  private release(entry: ResourceEntry): void {
    if (!entry.active) return;
    entry.active = false;
    entry.dispose();
  }
}
