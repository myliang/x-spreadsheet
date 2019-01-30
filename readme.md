# x-spreadsheet
[![npm package](https://img.shields.io/npm/v/x-data-spreadsheet.svg)](https://www.npmjs.org/package/x-data-spreadsheet)
[![NPM downloads](http://img.shields.io/npm/dm/x-data-spreadsheet.svg)](https://npmjs.org/package/x-data-spreadsheet)

> Una hoja de cálculo javascript (canvas) para web
<p align="center">
  <a href="https://github.com/myliang/x-spreadsheet">
    <img width="100%" src="https://raw.githubusercontent.com/myliang/x-spreadsheet/master/docs/demo.png">
  </a>
</p>

## Instalación
``` shell
npm install x-data-spreadsheet
``` 

## Inicio rápido
``` html
<div id="x-spreadsheet-demo"></div>
```

``` javascript
import Spreadsheet from 'x-data-spreadsheet';
// Si necesita anular las opciones predeterminadas, puede establecer la anulación
// const options = {};
// new Spreadsheet('#x-spreadsheet-demo', options);
new Spreadsheet('#x-spreadsheet-demo')
  .loadData({}) // Cargar datos
  .change((data) => {
    // guardar datos en la db
  });
```

```javascript
// opciones predeterminadas
{
  view: {
    height: () => document.documentElement.clientHeight - 41,
    width: () => document.documentElement.clientWidth,
  },
  formats: [],
  fonts: [],
  formula: [],
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
    textDecoration: 'normal',
    strikethrough: false,
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

## Desarrollo
``` sheel
git clone https://github.com/myliang/x-spreadsheet.git
cd x-spreadsheet
npm install
npm run dev
```
Abre tu navegador y visita http://127.0.0.1:8080.

## Navegadores Soportados
Navegadores modernos (chrome, firefox, safari).

## LICENCIA
MIT
