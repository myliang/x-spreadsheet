import type { LocaleDefinition } from '../core';

export const nl: LocaleDefinition = {
  id: 'nl',
  messages: {
    toolbar: {
      undo: 'Ongedaan maken',
      redo: 'Opnieuw uitvoeren',
      print: 'Afdrukken',
      paintFormat: 'Opmaak kopiëren',
      clearFormat: 'Opmaak wissen',
      formatting: 'Opmaak',
      fontName: 'Lettertype',
      fontSize: 'Tekengrootte',
      bold: 'Vet',
      italic: 'Cursief',
      underline: 'Onderstrepen',
      strike: 'Doorstrepen',
      textColor: 'Tekstkleur',
      fillColor: 'Opvulkleur',
      border: 'Randen',
      merge: 'Cellen samenvoegen',
      freeze: 'Bevriezen',
      filter: 'Filter',
    },
    context: {
      copy: 'Kopiëren',
      cut: 'Knippen',
      paste: 'Plakken',
      'paste-value': 'Alleen waarden plakken',
      'paste-format': 'Alleen opmaak plakken',
      'insert-row': 'Rij invoegen',
      'delete-row': 'Rij verwijderen',
      'insert-column': 'Kolom invoegen',
      'delete-column': 'Kolom verwijderen',
      'clear-contents': 'Inhoud wissen',
    },
    common: {
      cancel: 'Annuleren',
      save: 'Opslaan',
    },
  },
};

export default nl;
