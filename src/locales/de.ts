import type { LocaleDefinition } from '../core';

export const de: LocaleDefinition = {
  id: 'de',
  messages: {
    toolbar: {
      undo: 'Rückgängig machen',
      redo: 'Wiederherstellen',
      print: 'Drucken',
      paintFormat: 'Format kopieren',
      clearFormat: 'Format löschen',
      formatting: 'Formatierung',
      fontName: 'Schriftart',
      fontSize: 'Schriftgrad',
      bold: 'Fett',
      italic: 'Kursiv',
      underline: 'Unterstreichen',
      strike: 'Durchstreichen',
      textColor: 'Textfarbe',
      fillColor: 'Füllfarbe',
      border: 'Rahmen',
      merge: 'Zellen verbinden',
      freeze: 'Fixieren',
      filter: 'Filter',
    },
    context: {
      copy: 'Kopieren',
      cut: 'Ausschneiden',
      paste: 'Einfügen',
      'paste-value': 'Nur Werte einfügen',
      'paste-format': 'Nur Format einfügen',
      'insert-row': 'Zeile einfügen',
      'delete-row': 'Zeile löschen',
      'insert-column': 'Spalte einfügen',
      'delete-column': 'Spalte löschen',
      'clear-contents': 'Inhalt löschen',
    },
    common: {
      cancel: 'Abbrechen',
      save: 'Speichern',
    },
  },
};

export default de;
