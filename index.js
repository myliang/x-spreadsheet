import Spreadsheet from './src';

const saveIcon = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/PjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+PHN2ZyB0PSIxNTc3MTc3MDkyOTg4IiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjI2NzgiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPjxkZWZzPjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+PC9zdHlsZT48L2RlZnM+PHBhdGggZD0iTTIxMy4zMzMzMzMgMTI4aDU5Ny4zMzMzMzRhODUuMzMzMzMzIDg1LjMzMzMzMyAwIDAgMSA4NS4zMzMzMzMgODUuMzMzMzMzdjU5Ny4zMzMzMzRhODUuMzMzMzMzIDg1LjMzMzMzMyAwIDAgMS04NS4zMzMzMzMgODUuMzMzMzMzSDIxMy4zMzMzMzNhODUuMzMzMzMzIDg1LjMzMzMzMyAwIDAgMS04NS4zMzMzMzMtODUuMzMzMzMzVjIxMy4zMzMzMzNhODUuMzMzMzMzIDg1LjMzMzMzMyAwIDAgMSA4NS4zMzMzMzMtODUuMzMzMzMzeiBtMzY2LjkzMzMzNCAxMjhoMzQuMTMzMzMzYTI1LjYgMjUuNiAwIDAgMSAyNS42IDI1LjZ2MTE5LjQ2NjY2N2EyNS42IDI1LjYgMCAwIDEtMjUuNiAyNS42aC0zNC4xMzMzMzNhMjUuNiAyNS42IDAgMCAxLTI1LjYtMjUuNlYyODEuNmEyNS42IDI1LjYgMCAwIDEgMjUuNi0yNS42ek0yMTMuMzMzMzMzIDIxMy4zMzMzMzN2NTk3LjMzMzMzNGg1OTcuMzMzMzM0VjIxMy4zMzMzMzNIMjEzLjMzMzMzM3ogbTEyOCAwdjI1NmgzNDEuMzMzMzM0VjIxMy4zMzMzMzNoODUuMzMzMzMzdjI5OC42NjY2NjdhNDIuNjY2NjY3IDQyLjY2NjY2NyAwIDAgMS00Mi42NjY2NjcgNDIuNjY2NjY3SDI5OC42NjY2NjdhNDIuNjY2NjY3IDQyLjY2NjY2NyAwIDAgMS00Mi42NjY2NjctNDIuNjY2NjY3VjIxMy4zMzMzMzNoODUuMzMzMzMzek0yNTYgMjEzLjMzMzMzM2g4NS4zMzMzMzMtODUuMzMzMzMzeiBtNDI2LjY2NjY2NyAwaDg1LjMzMzMzMy04NS4zMzMzMzN6IG0wIDU5Ny4zMzMzMzR2LTEyOEgzNDEuMzMzMzMzdjEyOEgyNTZ2LTE3MC42NjY2NjdhNDIuNjY2NjY3IDQyLjY2NjY2NyAwIDAgMSA0Mi42NjY2NjctNDIuNjY2NjY3aDQyNi42NjY2NjZhNDIuNjY2NjY3IDQyLjY2NjY2NyAwIDAgMSA0Mi42NjY2NjcgNDIuNjY2NjY3djE3MC42NjY2NjdoLTg1LjMzMzMzM3ogbTg1LjMzMzMzMyAwaC04NS4zMzMzMzMgODUuMzMzMzMzek0zNDEuMzMzMzMzIDgxMC42NjY2NjdIMjU2aDg1LjMzMzMzM3oiIHAtaWQ9IjI2NzkiIGZpbGw9IiMyYzJjMmMiPjwvcGF0aD48L3N2Zz4=';
// eslint-disable-next-line no-undef
const previewEl = document.createElement('img');
previewEl.src = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/PjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+PHN2ZyB0PSIxNjIxMzI4NTkxMjQzIiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjU2NjMiIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCI+PGRlZnM+PHN0eWxlIHR5cGU9InRleHQvY3NzIj48L3N0eWxlPjwvZGVmcz48cGF0aCBkPSJNNTEyIDE4Ny45MDRhNDM1LjM5MiA0MzUuMzkyIDAgMCAwLTQxOC41NiAzMTUuNjQ4IDQzNS4zMjggNDM1LjMyOCAwIDAgMCA4MzcuMTIgMEE0MzUuNDU2IDQzNS40NTYgMCAwIDAgNTEyIDE4Ny45MDR6TTUxMiAzMjBhMTkyIDE5MiAwIDEgMSAwIDM4NCAxOTIgMTkyIDAgMCAxIDAtMzg0eiBtMCA3Ni44YTExNS4yIDExNS4yIDAgMSAwIDAgMjMwLjQgMTE1LjIgMTE1LjIgMCAwIDAgMC0yMzAuNHpNMTQuMDggNTAzLjQ4OEwxOC41NiA0ODUuNzZsNC44NjQtMTYuMzg0IDQuOTI4LTE0Ljg0OCA4LjA2NC0yMS41NjggNC4wMzItOS43OTIgNC43MzYtMTAuODggOS4zNDQtMTkuNDU2IDEwLjc1Mi0yMC4wOTYgMTIuNjA4LTIxLjMxMkE1MTEuNjE2IDUxMS42MTYgMCAwIDEgNTEyIDExMS4xMDRhNTExLjQ4OCA1MTEuNDg4IDAgMCAxIDQyNC41MTIgMjI1LjY2NGwxMC4yNCAxNS42OGMxMS45MDQgMTkuMiAyMi41OTIgMzkuMTA0IDMyIDU5Ljc3NmwxMC40OTYgMjQuOTYgNC44NjQgMTMuMTg0IDYuNCAxOC45NDQgNC40MTYgMTQuODQ4IDQuOTkyIDE5LjM5Mi0zLjIgMTIuODY0LTMuNTg0IDEyLjgtNi40IDIwLjA5Ni00LjQ4IDEyLjYwOC00Ljk5MiAxMi45MjhhNTExLjM2IDUxMS4zNiAwIDAgMS0xNy4yOCAzOC40bC0xMi4wMzIgMjIuNC0xMS45NjggMjAuMDk2QTUxMS41NTIgNTExLjU1MiAwIDAgMSA1MTIgODk2YTUxMS40ODggNTExLjQ4OCAwIDAgMS00MjQuNDQ4LTIyNS42bC0xMS4zMjgtMTcuNTM2YTUxMS4yMzIgNTExLjIzMiAwIDAgMS0xOS44NC0zNS4wMDhMNTMuMzc2IDYxMS44NGwtOC42NC0xOC4yNC0xMC4xMTItMjQuMTI4LTcuMTY4LTE5LjY0OC04LjMyLTI2LjYyNC0yLjYyNC05Ljc5Mi0yLjQ5Ni05LjkyeiIgcC1pZD0iNTY2NCI+PC9wYXRoPjwvc3ZnPg==';
previewEl.width = 16;
previewEl.height = 16;

const initialCols = [
  'VendorID',
  'SeasonID',
  'ProductID',
  'Fehler',
  'Fehler ignorieren?',
  'Marke',
  'Artikelname',
  'Herstellerartikelnummer',
  'Farbcode',
  'Größencode',
  'H-SKU',
  'EAN',
  'UPC',
  'Code 128',
  'Sonstige Codes',
  'Größensystem',
  'Größe1',
  'Größe2',
  'Sonstiges',
  'Farbbezeichnung',
  'Formelspalte1',
  'Geschlecht',
  'Mwst.',
  'FEDAS/eigenes Kategoriesystem',
  'VPE',
  'EK',
  'UVP DE EUR',
  'UVP UK GBP',
  'UVP CH CHF',
  'UVP FR EUR',
  'UVP NL EUR',
  'UVP DK EUR',
  'UVP NO EUR',
  'UVP SE EUR',
  'UVP FI EUR',
  'UVP IT EUR',
  'UVP ESP EUR',
  'UVP CH EUR',
  'UVP AT EUR',
  'NOS (0/1)',
  'Gefahrgut (J/N)',
  'Gefahrstoff (J/N)',
  'URL',
  'Zutaten/Nährwerte',
  'Materialzusammensetzung',
  'Zolltarifnummer DE',
  'Ursprungsland',
  'Erzeugerland',
  'Netto-Produktgewicht (kg)',
  'Brutto-Produktgewicht (kg)',
  'Verpackungshöhe (cm)',
  'Verpackungsbreite (cm)',
  'Verpackungslänge (cm)',
  'Verpackungsart',
  'Kollektion',
  'Live-Datum',
  'Business Unit',
  'Bemerkung',
  'IST-Saison',
  'K 1',
  'K 2',
  'K 3',
  'K1 Text',
  'Bergfreunde SKU',
  'Datum Import',
  'User Import',
  'Datum Änderung',
  'User Änderung',
  'Bestellmenge',
  'Hat Produktstatus',
  'CHECKSUM_OLD',
  'CHECKSUM_NEW',
  'Löschen',
  'Hilfsspalte',
];

const cells = initialCols.reduce((acc, cur, i) => ({
  ...acc,
  [i]: { text: cur },
}), {});

const obj = {
  0: { text: 80490 },
  1: { text: 324 },
  2: { text: 7 },
  3: { text: 36 },
  4: { text: 'adidas' },
  5: { text: 'ADISSAGE' },
  6: { text: '78260' },
  7: { text: '' },
  8: { text: '' },
  9: { text: '' },
  10: { text: '4003420221129' },
  11: { text: '060595167748' },
  12: { text: '' },
  13: { text: '' },
  14: { text: null },
  15: { text: '35' },
  16: { text: '' },
  17: { text: 'BLACK/BLACK/RUNNING WHITE FTW' },
  18: { text: 'M' },
  19: { text: '315901' },
  20: { text: 1 },
  21: { text: '15.0000' },
  22: { text: '29.9500' },
  23: { text: 0 },
  24: { text: 0 },
  25: { text: 0 },
  26: { text: '' },
  27: { text: '' },
  28: { text: '' },
  29: { text: '640299390000' },
  30: { text: 'VIETNAM' },
  31: { text: '' },
  32: { text: null },
  33: { text: null },
  34: { text: null },
  35: { text: null },
  36: { text: null },
  37: { text: '' },
  38: { text: '' },
  39: { text: null },
  40: { text: '00' },
  41: { text: null },
  42: { text: '' },
  43: { text: '02550' },
  44: { text: '' },
  45: { text: '' },
  46: { text: '' },
};

const rowLength = 56;
const rows = new Array(rowLength)
  .fill(obj)
  .map((elm, i) => ({
    [i + 1]: {
      cells: {
        ...(Object.entries(elm).reduce((acc, [key, { text }]) => ({
          ...acc,
          [key]: { text },
        }), {})),
      },
    },
  })).reduce((acc, curr) => ({
    ...acc,
    ...curr,
  }), {});

const instance = Spreadsheet.getInstance('#x-spreadsheet-demo');

const numberFormat = { format: 'number' };
const excludeRows = [{ property: 'style', indices: [0] }];

instance.loadData([
  {
    cols: {
      len: initialCols.length,
      0: { style: numberFormat, editable: false, excludeRows },
      3: { style: numberFormat, excludeRows },
    },
    rows: {
      len: rowLength + 1,
      0: { cells },
      ...rows,
    },
  },
]);
