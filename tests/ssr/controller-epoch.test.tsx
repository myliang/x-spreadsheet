import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { useControllerEpoch } from '../../src/react/hooks/use-controller-epoch';

it('renders the controller boundary without browser globals or layout-effect warnings', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  function Probe() {
    const epoch = useControllerEpoch({ defaultValue: [{}], readOnly: true });
    return <output>{epoch === null ? 'pending' : 'active'}</output>;
  }

  expect(renderToString(<Probe />)).toBe('<output>pending</output>');
  expect(consoleError).not.toHaveBeenCalled();
});
