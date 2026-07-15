export interface AnimationFramePort {
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
}

function browserAnimationFrame(): AnimationFramePort {
  if (typeof globalThis.requestAnimationFrame !== 'function'
    || typeof globalThis.cancelAnimationFrame !== 'function') {
    throw new TypeError('AnimationFramePort is required outside a browser');
  }
  return {
    request: callback => globalThis.requestAnimationFrame(callback),
    cancel: id => globalThis.cancelAnimationFrame(id),
  };
}

export class RenderScheduler {
  private readonly animationFrame: AnimationFramePort;
  private frame: number | null = null;
  private disposed = false;

  constructor(animationFrame?: AnimationFramePort) {
    this.animationFrame = animationFrame ?? browserAnimationFrame();
  }

  schedule(callback: () => void): void {
    if (this.disposed || this.frame !== null) return;
    this.frame = this.animationFrame.request(() => {
      this.frame = null;
      if (!this.disposed) callback();
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame !== null) {
      this.animationFrame.cancel(this.frame);
      this.frame = null;
    }
  }
}
