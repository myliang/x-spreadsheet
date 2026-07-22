import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoadmapSection } from '../../../demo/src/roadmap-section';

describe('RoadmapSection', () => {
  it('renders planned items and navigable design links without task controls', () => {
    render(<RoadmapSection />);

    const section = screen.getByRole('region', { name: 'Product roadmap' });
    const designLink = within(section).getByRole('link', {
      name: /Sheet, selection and range print targets/i,
    });

    expect(within(section).getAllByText('Planned')).toHaveLength(33);
    expect(designLink.getAttribute('href')).toBe('./roadmap/template-printing.md');
    expect(within(section).queryByRole('checkbox')).toBeNull();
  });
});
