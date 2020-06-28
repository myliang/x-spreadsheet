# x-spreadsheet

[![npm package](https://img.shields.io/npm/v/x-data-spreadsheet.svg)](https://www.npmjs.org/package/x-data-spreadsheet)
[![NPM downloads](http://img.shields.io/npm/dm/x-data-spreadsheet.svg)](https://npmjs.org/package/x-data-spreadsheet)
[![NPM downloads](http://img.shields.io/npm/dt/x-data-spreadsheet.svg)](https://npmjs.org/package/x-data-spreadsheet)
[![Build passing](https://travis-ci.org/myliang/x-spreadsheet.svg?branch=master)](https://travis-ci.org/myliang/x-spreadsheet)
[![codecov](https://codecov.io/gh/myliang/x-spreadsheet/branch/master/graph/badge.svg)](https://codecov.io/gh/myliang/x-spreadsheet)
![GitHub](https://img.shields.io/github/license/myliang/x-spreadsheet.svg)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/myliang/x-spreadsheet.svg)
[![Join the chat at https://gitter.im/x-datav/spreadsheet](https://badges.gitter.im/x-datav/spreadsheet.svg)](https://gitter.im/x-datav/spreadsheet?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

> Una hoja de cálculo JavaScript basada en la web
<p align="center">
  <a href="https://github.com/myliang/x-spreadsheet">
    <img width="100%" src="https://raw.githubusercontent.com/myliang/x-spreadsheet/master/docs/demo.png">
  </a>
</p>

## Idiomas disponibles

* de
* en
* es
* nl
* [zh-cn 中文](https://hondrytravis.github.io/x-spreadsheet-doc/)

## CDN
```html
<link rel="stylesheet" href="https://unpkg.com/x-data-spreadsheet@1.1.4/dist/xspreadsheet.css">
<script src="https://unpkg.com/x-data-spreadsheet@1.1.4/dist/xspreadsheet.js"></script>

<script>
   x_spreadsheet('#xspreadsheet');
</script>
```

## NPM

```shell
npm install x-data-spreadsheet
```

```html
<div id="x-spreadsheet-demo"></div>
```

```javascript
import Spreadsheet from "x-data-spreadsheet";
// Si necesita sobreescribir las opciones predeterminadas, puede establecer la sobreescritura (override)
// const options = {};
// new Spreadsheet('#x-spreadsheet-demo', options);
const s = new Spreadsheet("#x-spreadsheet-demo")
  .loadData({}) // load data
  .change(data => {
    // save data to db
  });

// data validation
s.validate()
```

```javascript
// default options
{
  mode: 'edit', // edit | read
  showToolbar: true,
  showGrid: true,
  showContextmenu: true,
  view: {
    height: () => document.documentElement.clientHeight,
    width: () => document.documentElement.clientWidth,
  },
  row: {
    len: 100,
    height: 25,
  },
  col: {
    len: 26,
    width: 100,
    indexWidth: 60,
    minWidth: 60,
  },
  style: {
    bgcolor: '#ffffff',
    align: 'left',
    valign: 'middle',
    textwrap: false,
    strike: false,
    underline: false,
    color: '#0a0a0a',
    font: {
      name: 'Helvetica',
      size: 10,
      bold: false,
      italic: false,
    },
  },
}
```

## import | export xlsx

https://github.com/SheetJS/sheetjs/tree/master/demos/xspreadsheet#saving-data

thanks https://github.com/SheetJS/sheetjs

## Bind events
```javascript
const s = new Spreadsheet("#x-spreadsheet-demo")
// event of click on cell
s.on('cell-selected', (cell, ri, ci) => {});
s.on('cells-selected', (cell, { sri, sci, eri, eci }) => {});
// edited on cell
s.on('cell-edited', (text, ri, ci) => {});
```

## update cell-text
```javascript
const s = new Spreadsheet("#x-spreadsheet-demo")
// cellText(ri, ci, text, sheetIndex = 0)
s.cellText(5, 5, 'xxxx').cellText(6, 5, 'yyy').reRender();
```

## get cell and cell-style
```javascript
const s = new Spreadsheet("#x-spreadsheet-demo")
// cell(ri, ci, sheetIndex = 0)
s.cell(ri, ci);
// cellStyle(ri, ci, sheetIndex = 0)
s.cellStyle(ri, ci);
```

## Internacionalización
```javascript
// npm 
es
import Spreadsheet from 'x-data-spreadsheet';
import es from 'x-data-spreadsheet/dist/locale/es';

Spreadsheet.locale('es', es);
new Spreadsheet(document.getElementById('xss-demo'));

zh-cn
import Spreadsheet from 'x-data-spreadsheet';
import zhCN from 'x-data-spreadsheet/dist/locale/zh-cn';

Spreadsheet.locale('zh-cn', zhCN);
new Spreadsheet(document.getElementById('xss-demo'));
```
```html
<!-- Importar via CDN -->
<link rel="stylesheet" href="https://unpkg.com/x-data-spreadsheet@1.1.4/dist/xspreadsheet.css">
<script src="https://unpkg.com/x-data-spreadsheet@1.1.4/dist/xspreadsheet.js"></script>
<script src="https://unpkg.com/x-data-spreadsheet@1.1.4/dist/locale/zh-cn.js"></script>

<script>
  x_spreadsheet.locale('zh-cn');
</script>
______
es
<script src="https://unpkg.com/x-data-spreadsheet@1.1.4/dist/locale/es.js"></script>
<script>
  x_spreadsheet.locale('es');
</script>

```

## Características
- Deshacer rehacer
  - Formato de pintura
  - Formato claro
  - Formato
  - fuente
  - Tamaño de fuente
  - Negrita
  - Fuente cursiva
  - Subrayado
  - Huelga
  - Color de texto
  - Color de relleno
  - Fronteras
  - Combinar células
  - Alinear
  - Ajuste de texto
  - Congelar celda
  - Funciones o Fórmulas
  - Cambiar el tamaño de la fila de altura, ancho de columna
  - Copiar, cortar, pegar
  - Autocompletar
  - Insertar fila, columna
  - Eliminar fila, columna
  - ocultar fila, columna
  - múltiples hojas
  - impresión
  - Validaciones de datos

## Desarrollo

```sheel
git clone https://github.com/myliang/x-spreadsheet.git
cd x-spreadsheet
npm install
npm run dev
```

Abre tu navegador y visita http://127.0.0.1:8080.

## Soporte de navegador

Navegadores modernos(chrome, firefox, Safari).

## LICENCIA

MIT
