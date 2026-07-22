import { describe, expect, it } from 'vitest';
import {
  groupRoadmapItems,
  roadmapItems,
  roadmapPhases,
} from '../../../demo/src/roadmap';

describe('GitHub Pages roadmap data', () => {
  it('contains the approved planned capabilities in dependency order', () => {
    expect(roadmapItems).toHaveLength(33);
    expect(roadmapItems.every(item => item.status === 'planned')).toBe(true);
    expect(roadmapItems[0]?.title).toBe('Workbook 2.0 typed document model');
    expect(roadmapItems.some(item => item.title === 'Safe scalar bindings, repeat rows and conditional ranges')).toBe(true);
  });

  it('groups every item under a declared phase with a local design link', () => {
    const groups = groupRoadmapItems();

    expect([...groups.keys()]).toEqual(roadmapPhases.map(phase => phase.id));
    expect([...groups.values()].flat()).toHaveLength(roadmapItems.length);
    expect(roadmapItems.every(item => item.designHref.startsWith('./roadmap/'))).toBe(true);
  });
});
