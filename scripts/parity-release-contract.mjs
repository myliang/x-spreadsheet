export const parityReleaseContextPath = 'test-results/parity/release-context.json';

export const browserProjects = Object.freeze([
  { name: 'chromium-desktop', use: { browserName: 'chromium', viewport: { height: 720, width: 1280 } } },
  { name: 'firefox-desktop', use: { browserName: 'firefox', viewport: { height: 720, width: 1280 } } },
  { name: 'webkit-desktop', use: { browserName: 'webkit', viewport: { height: 720, width: 1280 } } },
  { name: 'chromium-touch', use: { browserName: 'chromium', hasTouch: true, viewport: { height: 844, width: 390 } } },
  { name: 'firefox-touch', use: { browserName: 'firefox', hasTouch: true, viewport: { height: 844, width: 390 } } },
  { name: 'webkit-touch', use: { browserName: 'webkit', hasTouch: true, viewport: { height: 844, width: 390 } } },
]);

export const visualProjects = Object.freeze([
  { name: 'desktop-dpr1', use: { browserName: 'chromium', deviceScaleFactor: 1, viewport: { height: 720, width: 1280 } } },
  { name: 'desktop-dpr2', use: { browserName: 'chromium', deviceScaleFactor: 2, viewport: { height: 720, width: 1280 } } },
  { name: 'touch-dpr1', use: { browserName: 'chromium', deviceScaleFactor: 1, hasTouch: true, isMobile: true, viewport: { height: 844, width: 390 } } },
  { name: 'touch-dpr2', use: { browserName: 'chromium', deviceScaleFactor: 2, hasTouch: true, isMobile: true, viewport: { height: 844, width: 390 } } },
]);

export const parityProjectContract = Object.freeze({
  unit: Object.freeze(['unit']),
  component: Object.freeze(['component']),
  browser: Object.freeze(browserProjects.map(project => project.name)),
  visual: Object.freeze(visualProjects.map(project => project.name)),
});

export const parityAllowedProjectSkips = Object.freeze({
  unit: Object.freeze({}),
  component: Object.freeze({}),
  browser: Object.freeze({
    'input.touch-gestures': Object.freeze([
      'chromium-desktop',
      'firefox-desktop',
      'webkit-desktop',
    ]),
  }),
  visual: Object.freeze({}),
});

export const parityLaneConfigFiles = Object.freeze({
  unit: Object.freeze(['vitest.config.ts']),
  component: Object.freeze(['vitest.config.ts']),
  browser: Object.freeze(['playwright.config.ts']),
  visual: Object.freeze(['playwright.visual.config.ts']),
});
