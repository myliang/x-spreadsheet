export type RoadmapPhaseId = 0 | 1 | 2 | 3 | 4;
export type RoadmapStatus = 'planned';

export interface RoadmapPhase {
  readonly id: RoadmapPhaseId;
  readonly label: string;
  readonly title: string;
  readonly summary: string;
}

export interface RoadmapItem {
  readonly id: string;
  readonly phase: RoadmapPhaseId;
  readonly title: string;
  readonly summary: string;
  readonly status: RoadmapStatus;
  readonly designHref: `./roadmap/${string}.md`;
}

export const roadmapPhases = [
  {
    id: 0,
    label: 'Foundation',
    title: 'A deterministic document core',
    summary: 'Replace mutable legacy state with typed documents, atomic commands and shared render semantics.',
  },
  {
    id: 1,
    label: 'Template Print MVP',
    title: 'Print only the sheet or range that matters',
    summary: 'Turn spreadsheet regions into predictable templates, previews and isolated browser print jobs.',
  },
  {
    id: 2,
    label: 'Document Generation',
    title: 'From one template to production outputs',
    summary: 'Add advanced repeats, managed resources and deterministic PDF, XLSX and image adapters.',
  },
  {
    id: 3,
    label: 'Spreadsheet Depth',
    title: 'The capabilities expected from a modern spreadsheet',
    summary: 'Grow formulas, data tooling, interchange, analysis and visualization on the same document model.',
  },
  {
    id: 4,
    label: 'SDK Ecosystem',
    title: 'Stable extension points for host applications',
    summary: 'Expose versioned plugins and adapters while keeping storage, collaboration and AI host-owned.',
  },
] as const satisfies readonly RoadmapPhase[];

const item = (
  id: string,
  phase: RoadmapPhaseId,
  title: string,
  summary: string,
  designHref: RoadmapItem['designHref'],
): RoadmapItem => ({ id, phase, title, summary, status: 'planned', designHref });

export const roadmapItems = [
  item('workbook-2', 0, 'Workbook 2.0 typed document model', 'Stable IDs, typed cells and deterministic serialization.', './roadmap/foundation.md'),
  item('transactions', 0, 'Atomic Command / Transaction', 'One validated and reversible mutation boundary for every edit.', './roadmap/foundation.md'),
  item('formula-format-core', 0, 'Formula dependency and number-format core', 'Excel-aligned values, dependencies, errors and display text.', './roadmap/foundation.md'),
  item('render-semantics', 0, 'Shared render semantics and Canvas accessibility', 'One presentation model for screen, accessibility and print.', './roadmap/foundation.md'),
  item('extension-kernel', 0, 'Minimal cell-type and adapter registry kernel', 'Typed internal composition without exposing an unsafe plugin surface.', './roadmap/foundation.md'),
  item('print-targets', 1, 'Sheet, selection and range print targets', 'Print a chosen sheet or region without editor chrome.', './roadmap/template-printing.md'),
  item('template-bindings', 1, 'Safe scalar bindings, repeat rows and conditional ranges', 'Bind business data through a constrained template DSL.', './roadmap/template-printing.md'),
  item('pagination', 1, 'Deterministic pagination and print profiles', 'Make paper, margins, scaling, titles and page breaks explicit.', './roadmap/template-printing.md'),
  item('print-preview', 1, 'Page preview and isolated browser printing', 'Preview the exact pages rendered inside an isolated print document.', './roadmap/template-printing.md'),
  item('advanced-repeats', 2, 'Nested, horizontal, range and page repeats', 'Generate complex reports without arbitrary template code.', './roadmap/template-printing.md'),
  item('resource-pipeline', 2, 'Image, font, QR code and async resource pipeline', 'Resolve bounded external resources before deterministic layout.', './roadmap/template-printing.md'),
  item('pdf-output', 2, 'PDF Blob output', 'Translate the shared page display list into downloadable PDF data.', './roadmap/template-printing.md'),
  item('xlsx-output', 2, 'XLSX template output', 'Preserve semantic workbook content and print profiles in OOXML.', './roadmap/template-printing.md'),
  item('image-output', 2, 'SVG and PNG page output', 'Render selected generated pages as vector or bitmap images.', './roadmap/template-printing.md'),
  item('conditional-formatting', 3, 'Conditional formatting', 'Apply deterministic visual rules without mutating base styles.', './roadmap/formulas-data.md'),
  item('advanced-validation', 3, 'Advanced validation, dropdown and checkbox cells', 'Combine typed rules with accessible interactive cell controls.', './roadmap/formulas-data.md'),
  item('formula-library', 3, 'Expanded function library and cross-sheet references', 'Broaden Excel-compatible calculation with explicit support levels.', './roadmap/formulas-data.md'),
  item('array-formulas', 3, 'Named ranges, array and spill formulas', 'Model reusable names and dynamic multi-cell results safely.', './roadmap/formulas-data.md'),
  item('saved-views', 3, 'Multi-column sort, conditional filter and saved views', 'Separate reusable data views from destructive row changes.', './roadmap/formulas-data.md'),
  item('data-cleanup', 3, 'Grouping, deduplication, text split and data cleanup', 'Preview data transformations before one atomic command commits them.', './roadmap/formulas-data.md'),
  item('file-interchange', 3, 'CSV/TSV, XLSX and ODS interchange', 'Import and export common spreadsheet formats with diagnostics.', './roadmap/formulas-data.md'),
  item('structured-tables', 3, 'Structured tables and structured references', 'Give tabular regions stable identity, columns and formula semantics.', './roadmap/analysis-visualization.md'),
  item('charts', 3, 'Charts and Sparklines', 'Render data-bound visualizations through deterministic series models.', './roadmap/analysis-visualization.md'),
  item('objects', 3, 'Images, shapes, text boxes and anchored objects', 'Keep floating content attached through structural sheet edits.', './roadmap/analysis-visualization.md'),
  item('pivot-slicer', 3, 'PivotTable and Slicer', 'Build refreshable aggregations and connected filter controls.', './roadmap/analysis-visualization.md'),
  item('solver', 3, 'Goal Seek and pluggable Solver', 'Express bounded optimization without embedding a solver service.', './roadmap/analysis-visualization.md'),
  item('cell-sdk', 4, 'Public structured cell renderer/editor plugin SDK', 'Open the typed cell protocol to trusted host extensions.', './roadmap/extensibility.md'),
  item('template-sdk', 4, 'Versioned Template Module SDK', 'Extend compilation through validated intermediate-representation hooks.', './roadmap/extensibility.md'),
  item('adapter-sdk', 4, 'Public adapter lifecycle, trust policy and compatibility SDK', 'Make environment, capabilities and cleanup explicit for integrations.', './roadmap/extensibility.md'),
  item('persistence-history', 4, 'Persistence and version history adapters', 'Let hosts save snapshots and expose durable revision history.', './roadmap/host-integrations.md'),
  item('collaboration', 4, 'Collaboration and remote selection adapters', 'Integrate host-owned synchronization without selecting a CRDT backend.', './roadmap/host-integrations.md'),
  item('permission-comments', 4, 'Permission and comment adapters', 'Connect authorization and discussion while preserving command checks.', './roadmap/host-integrations.md'),
  item('ai-commands', 4, 'Validated AI command proposals', 'Require schema validation, dry-run and user confirmation before changes.', './roadmap/host-integrations.md'),
] as const satisfies readonly RoadmapItem[];

export function groupRoadmapItems(): ReadonlyMap<RoadmapPhaseId, readonly RoadmapItem[]> {
  return new Map(roadmapPhases.map(phase => [
    phase.id,
    roadmapItems.filter(roadmapItem => roadmapItem.phase === phase.id),
  ]));
}
