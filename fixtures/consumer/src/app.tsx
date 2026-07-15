import { useRef } from 'react';
import { TegoSheet, type TegoSheetHandle, type WorkbookData } from 'tego-sheet';
import { zhCN } from 'tego-sheet/locales/zh-cn';

const workbook: WorkbookData = [{
  name: 'Consumer',
  rows: { 0: { cells: { 0: { text: 'Packed artifact' } } } },
}];

export function App() {
  const sheet = useRef<TegoSheetHandle>(null);
  return <TegoSheet ref={sheet} defaultValue={workbook} locale={zhCN} />;
}
