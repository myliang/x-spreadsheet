import type {
  AnimationFramePort,
  CanvasSurfacePort,
  TextMeasurementPort,
} from '../../src/engine/canvas/canvas-engine';

export interface CanvasOperation {
  readonly name: string;
  readonly args: readonly unknown[];
}

export interface CanvasHarness {
  readonly canvas: CanvasSurfacePort;
  readonly operations: CanvasOperation[];
  readonly animationFrame: AnimationFramePort & {
    readonly cancelled: readonly number[];
    readonly pending: number;
    flush(): void;
  };
  readonly measurement: TextMeasurementPort;
}

export function createCanvasHarness(): CanvasHarness {
  const operations: CanvasOperation[] = [];
  const state: Record<string, unknown> = {};
  let translation = { x: 0, y: 0 };
  const translationStack: Array<{ x: number; y: number }> = [];
  const record = (name: string, ...args: unknown[]): void => {
    operations.push({ name, args });
  };
  const context = new Proxy(state, {
    get(target, property) {
      if (property in target) return target[property as string];
      if (property === 'measureText') {
        return (text: string) => ({ width: text.length * 7 });
      }
      if (property === 'save') {
        return () => {
          translationStack.push({ ...translation });
          record('save');
        };
      }
      if (property === 'restore') {
        return () => {
          translation = translationStack.pop() ?? { x: 0, y: 0 };
          record('restore');
        };
      }
      if (property === 'setTransform') {
        return (...args: unknown[]) => {
          translation = { x: 0, y: 0 };
          record('setTransform', ...args);
        };
      }
      if (property === 'translate') {
        return (x: number, y: number) => {
          translation = { x: translation.x + x, y: translation.y + y };
          record('translate', x, y);
        };
      }
      if (['fillText', 'fillRect', 'strokeRect', 'clearRect', 'moveTo', 'lineTo', 'rect'].includes(String(property))) {
        return (...args: unknown[]) => {
          const output = [...args];
          const offset = property === 'fillText' ? 1 : 0;
          if (typeof output[offset] === 'number') {
            output[offset] = (output[offset] as number) + translation.x;
          }
          if (typeof output[offset + 1] === 'number') {
            output[offset + 1] = (output[offset + 1] as number) + translation.y;
          }
          record(String(property), ...output);
        };
      }
      return (...args: unknown[]) => record(String(property), ...args);
    },
    set(target, property, value) {
      target[property as string] = value;
      record(`set:${String(property)}`, value);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  const canvas: CanvasSurfacePort = {
    width: 0,
    height: 0,
    style: { width: '', height: '' },
    getContext: () => context,
  };
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  const cancelled: number[] = [];
  const animationFrame = {
    request(callback: FrameRequestCallback): number {
      const id = nextId;
      nextId += 1;
      callbacks.set(id, callback);
      return id;
    },
    cancel(id: number): void {
      cancelled.push(id);
      callbacks.delete(id);
    },
    get cancelled(): readonly number[] {
      return cancelled;
    },
    get pending(): number {
      return callbacks.size;
    },
    flush(): void {
      const pending = [...callbacks.entries()];
      callbacks.clear();
      for (const [id, callback] of pending) callback(id);
    },
  };
  return {
    canvas,
    operations,
    animationFrame,
    measurement: {
      measureText: (text: string) => text.length * 7,
    },
  };
}
