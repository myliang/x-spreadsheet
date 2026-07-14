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

it('keeps JSON implementation helpers out of the package root', () => {
  // @ts-expect-error JsonPrimitive is an internal schema helper
  type PublicJsonPrimitive = import('../../src/index').JsonPrimitive;
  // @ts-expect-error JsonArray is an internal schema helper
  type PublicJsonArray = import('../../src/index').JsonArray;
  // @ts-expect-error JsonObject is an internal schema helper
  type PublicJsonObject = import('../../src/index').JsonObject;
  // @ts-expect-error JsonExtensible is an internal schema helper
  type PublicJsonExtensible = import('../../src/index').JsonExtensible<object>;

  expectTypeOf<PublicJsonPrimitive>().toBeAny();
  expectTypeOf<PublicJsonArray>().toBeAny();
  expectTypeOf<PublicJsonObject>().toBeAny();
  expectTypeOf<PublicJsonExtensible>().toBeAny();
});
