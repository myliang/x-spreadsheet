export interface TouchPointPort {
  readonly clientX: number;
  readonly clientY: number;
}

export interface TouchGestureCallbacks {
  readonly now: () => number;
  readonly tap: (point: TouchPointPort, double: boolean) => void;
  readonly swipe: (delta: Readonly<{ x: number; y: number }>) => boolean;
  readonly schedule?: (callback: () => void, delay: number) => () => void;
}

export class TouchGesture {
  private start: TouchPointPort | null = null;
  private last: TouchPointPort | null = null;
  private moved = false;
  private invalid = false;
  private lastTap: { readonly at: number; readonly point: TouchPointPort } | null = null;
  private cancelTapTimer: (() => void) | null = null;

  constructor(private readonly callbacks: TouchGestureCallbacks) {}

  startGesture(touches: readonly TouchPointPort[]): void {
    if (touches.length !== 1) {
      this.cancel();
      this.invalid = true;
      return;
    }
    this.invalid = false;
    this.start = touches[0]!;
    this.last = touches[0]!;
    this.moved = false;
  }

  moveGesture(touches: readonly TouchPointPort[]): boolean {
    if (this.invalid || this.last === null || touches.length !== 1) {
      if (touches.length !== 1) this.cancel();
      return false;
    }
    const point = touches[0]!;
    const dx = point.clientX - this.last.clientX;
    const dy = point.clientY - this.last.clientY;
    if (Math.abs(dx) <= 10 && Math.abs(dy) <= 10) return false;
    this.moved = true;
    this.last = point;
    return Math.abs(dx) > Math.abs(dy)
      ? this.callbacks.swipe({ x: -dx, y: 0 })
      : this.callbacks.swipe({ x: 0, y: -dy });
  }

  endGesture(changed: readonly TouchPointPort[], remaining: readonly TouchPointPort[]): void {
    if (this.invalid || remaining.length > 0 || changed.length !== 1 || this.start === null) {
      this.cancel();
      return;
    }
    const point = changed[0]!;
    if (!this.moved) {
      const now = this.callbacks.now();
      const previous = this.lastTap;
      const double = previous !== null
        && now - previous.at <= 300
        && Math.abs(previous.point.clientX - point.clientX) <= 10
        && Math.abs(previous.point.clientY - point.clientY) <= 10;
      this.callbacks.tap(point, double);
      this.cancelTapTimer?.();
      this.cancelTapTimer = null;
      this.lastTap = double ? null : { at: now, point };
      if (!double && this.callbacks.schedule !== undefined) {
        this.cancelTapTimer = this.callbacks.schedule(() => {
          this.lastTap = null;
          this.cancelTapTimer = null;
        }, 300);
      }
    }
    this.start = null;
    this.last = null;
    this.moved = false;
  }

  cancel(): void {
    this.start = null;
    this.last = null;
    this.moved = false;
    this.invalid = false;
  }

  dispose(): void {
    this.cancel();
    const cancel = this.cancelTapTimer;
    this.cancelTapTimer = null;
    this.lastTap = null;
    cancel?.();
  }
}
