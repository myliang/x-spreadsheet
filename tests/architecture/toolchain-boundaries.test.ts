import { expect, it } from 'vitest';
import viteConfig from '../../vite.config';

it('externalizes every React and React DOM runtime subpath', () => {
  const external = viteConfig.build?.rollupOptions?.external;

  expect(external).toBeTypeOf('function');
  if (typeof external !== 'function') {
    throw new TypeError('Vite must use a React external predicate');
  }

  for (const id of [
    'react',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-dom',
    'react-dom/client',
    'react-dom/server',
  ]) {
    expect(external(id, undefined, false), id).toBe(true);
  }

  for (const id of ['reactive', 'react-domestic', '@scope/react']) {
    expect(external(id, undefined, false), id).toBe(false);
  }
});
