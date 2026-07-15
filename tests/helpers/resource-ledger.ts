export type LedgerKind =
  | 'listener'
  | 'observer'
  | 'timer'
  | 'animation-frame'
  | 'subscription'
  | 'overlay';

export class ResourceLedger {
  private readonly counts = new Map<LedgerKind, number>();
  private readonly starting: Readonly<Record<LedgerKind, number>>;

  constructor() {
    this.starting = this.current();
  }

  acquire(kind: LedgerKind): () => void {
    this.counts.set(kind, (this.counts.get(kind) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) throw new Error(`${kind} resource was released more than once`);
      released = true;
      this.counts.set(kind, (this.counts.get(kind) ?? 0) - 1);
    };
  }

  baseline(): Readonly<Record<LedgerKind, number>> {
    return this.starting;
  }

  current(): Readonly<Record<LedgerKind, number>> {
    return Object.freeze({
      listener: this.counts.get('listener') ?? 0,
      observer: this.counts.get('observer') ?? 0,
      timer: this.counts.get('timer') ?? 0,
      'animation-frame': this.counts.get('animation-frame') ?? 0,
      subscription: this.counts.get('subscription') ?? 0,
      overlay: this.counts.get('overlay') ?? 0,
    });
  }
}

