import { expectTypeOf, it } from 'vitest';
import * as publicApi from '../../src/index';

it('does not expose the legacy constructor, emitter methods, or browser global', () => {
  // @ts-expect-error the imperative Spreadsheet constructor is intentionally not public
  new publicApi.Spreadsheet();
  // @ts-expect-error subscriptions are React callback props, not a public module emitter
  publicApi.on('change', () => undefined);
  // @ts-expect-error chainable change callbacks are intentionally not public
  publicApi.change(() => undefined);
  // @ts-expect-error tego-sheet never installs the legacy browser global
  window.x_spreadsheet('#sheet');

  expectTypeOf(publicApi).toBeObject();
});
