import { useMemo, useRef, useState } from 'react';
import {
  TegoSheet,
  zhCN,
  type TegoSheetHandle,
  type ToolbarRenderer,
  type WorkbookData,
  type WorkbookInput,
} from 'tego-sheet';

const legacyWorkbook: WorkbookData = [{
  name: 'Budget',
  freeze: 'B2',
  rows: {
    len: 5,
    0: { cells: { 0: { text: 'Item' }, 1: { text: 'Amount' } } },
    1: { cells: { 0: { text: 'Hosting' }, 1: { text: '29' } } },
    2: { cells: { 0: { text: 'Support' }, 1: { text: '75' } } },
    3: { cells: { 0: { text: 'Total' }, 1: { text: '=SUM(B2:B3)' } } },
  },
  cols: { len: 4 },
}];

const customToolbar: ToolbarRenderer = toolbar => (
  <div className="demo-toolbar">
    <button type="button" disabled={!toolbar.canUndo} onClick={() => toolbar.execute({ type: 'undo' })}>
      Undo
    </button>
    <button type="button" disabled={!toolbar.canRedo} onClick={() => toolbar.execute({ type: 'redo' })}>
      Redo
    </button>
    <button
      type="button"
      disabled={toolbar.disabledActions.has('set-style')}
      onClick={() => toolbar.execute({ type: 'set-style', patch: { font: { bold: true } } })}
    >
      Bold selection
    </button>
  </div>
);

function parseWorkbook(source: string): WorkbookInput {
  return JSON.parse(source) as WorkbookInput;
}

export function App() {
  const uncontrolledRef = useRef<TegoSheetHandle>(null);
  const [controlled, setControlled] = useState<WorkbookData>(legacyWorkbook);
  const [loaded, setLoaded] = useState<WorkbookInput>(legacyWorkbook);
  const [loadEpoch, setLoadEpoch] = useState(0);
  const [locale, setLocale] = useState<'en' | 'zh-CN'>('en');
  const [json, setJson] = useState(() => JSON.stringify(legacyWorkbook, null, 2));
  const localized = useMemo(() => locale === 'zh-CN' ? zhCN : undefined, [locale]);

  return (
    <main className="demo-page">
      <header>
        <p className="demo-kicker">React + TypeScript + Vite</p>
        <h1>tego-sheet</h1>
        <p>New React API, compatible workbook JSON and spreadsheet behavior.</p>
      </header>

      <section>
        <div className="demo-section-heading">
          <div>
            <h2>Uncontrolled workbook and legacy JSON</h2>
            <p>Load or export the same sparse JSON shape used by x-data-spreadsheet.</p>
          </div>
          <label>
            Locale
            <select value={locale} onChange={event => setLocale(event.currentTarget.value as 'en' | 'zh-CN')}>
              <option value="en">English</option>
              <option value="zh-CN">简体中文</option>
            </select>
          </label>
        </div>
        <div className="demo-json-tools">
          <textarea aria-label="Legacy workbook JSON" value={json} onChange={event => setJson(event.currentTarget.value)} />
          <div>
            <button type="button" onClick={() => {
              setLoaded(parseWorkbook(json));
              setLoadEpoch(value => value + 1);
            }}>
              Load JSON
            </button>
            <button type="button" onClick={() => setJson(JSON.stringify(uncontrolledRef.current?.getValue() ?? [], null, 2))}>
              Export JSON
            </button>
          </div>
        </div>
        <div className="demo-sheet-frame">
          <TegoSheet key={loadEpoch} ref={uncontrolledRef} defaultValue={loaded} locale={localized} />
        </div>
      </section>

      <section>
        <h2>Controlled workbook</h2>
        <p>The parent owns every accepted workbook update.</p>
        <div className="demo-sheet-frame">
          <TegoSheet value={controlled} onChange={value => setControlled(value)} />
        </div>
      </section>

      <section className="demo-grid">
        <div>
          <h2>Read-only</h2>
          <div className="demo-sheet-frame demo-sheet-frame--compact">
            <TegoSheet defaultValue={legacyWorkbook} readOnly toolbar={false} />
          </div>
        </div>
        <div>
          <h2>Custom toolbar</h2>
          <div className="demo-sheet-frame demo-sheet-frame--compact">
            <TegoSheet defaultValue={legacyWorkbook} toolbar={customToolbar} />
          </div>
        </div>
      </section>
    </main>
  );
}
