export const parityReleaseContextPath: string;
export const browserProjects: readonly Readonly<Record<string, unknown>>[];
export const visualProjects: readonly Readonly<Record<string, unknown>>[];
export const parityProjectContract: Readonly<Record<'unit' | 'component' | 'browser' | 'visual', readonly string[]>>;
export const parityAllowedProjectSkips: Readonly<Record<'unit' | 'component' | 'browser' | 'visual', Readonly<Record<string, readonly string[]>>>>;
export const parityLaneConfigFiles: Readonly<Record<'unit' | 'component' | 'browser' | 'visual', readonly string[]>>;
