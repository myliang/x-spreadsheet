import { describe, expect, it } from 'vitest';

import { DrawContext } from '../../../src/engine/canvas/draw-context';
import { createCanvasHarness } from '../../helpers/canvas-harness';

describe('DrawContext', () => {
  it.each([
    {
      width: Number.MAX_VALUE,
      height: 1,
      message: 'canvas backing width must be a non-negative safe integer',
    },
    {
      width: 1,
      height: Number.MAX_SAFE_INTEGER,
      message: 'canvas backing height must be a non-negative safe integer',
    },
  ])(
    'rejects an unsafe $message before mutating the canvas',
    ({ width, height, message }) => {
      const harness = createCanvasHarness();
      const draw = new DrawContext(harness.canvas, 2, harness.measurement);
      const initialCanvas = {
        width: harness.canvas.width,
        height: harness.canvas.height,
        style: { ...harness.canvas.style },
      };

      expect(() => draw.resize(width, height)).toThrowError(
        new RangeError(message),
      );
      expect(harness.canvas.width).toBe(initialCanvas.width);
      expect(harness.canvas.height).toBe(initialCanvas.height);
      expect(harness.canvas.style).toEqual(initialCanvas.style);
      expect(harness.operations).toEqual([]);
    },
  );

  it('rejects a backing dimension above the 16384-pixel limit atomically', () => {
    const harness = createCanvasHarness();
    const draw = new DrawContext(harness.canvas, 1, harness.measurement);
    const initialCanvas = {
      width: harness.canvas.width,
      height: harness.canvas.height,
      style: { ...harness.canvas.style },
    };

    expect(() => draw.resize(16_385, 1)).toThrowError(
      new RangeError('canvas backing width exceeds the 16384-pixel limit'),
    );
    expect(harness.canvas.width).toBe(initialCanvas.width);
    expect(harness.canvas.height).toBe(initialCanvas.height);
    expect(harness.canvas.style).toEqual(initialCanvas.style);
    expect(harness.operations).toEqual([]);
  });

  it('rejects a backing area above the 67108864-pixel limit atomically', () => {
    const harness = createCanvasHarness();
    const draw = new DrawContext(harness.canvas, 1, harness.measurement);
    const initialCanvas = {
      width: harness.canvas.width,
      height: harness.canvas.height,
      style: { ...harness.canvas.style },
    };

    expect(() => draw.resize(8_193, 8_193)).toThrowError(
      new RangeError('canvas backing area exceeds the 67108864-pixel limit'),
    );
    expect(harness.canvas.width).toBe(initialCanvas.width);
    expect(harness.canvas.height).toBe(initialCanvas.height);
    expect(harness.canvas.style).toEqual(initialCanvas.style);
    expect(harness.operations).toEqual([]);
  });
});
