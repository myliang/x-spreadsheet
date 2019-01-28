# x-spreadsheet
[![npm package](https://img.shields.io/npm/v/x-data-spreadsheet.svg)](https://www.npmjs.org/package/x-data-spreadsheet)
[![NPM downloads](http://img.shields.io/npm/dm/x-data-spreadsheet.svg)](https://npmjs.org/package/x-data-spreadsheet)

> a javascript(canvas) spreadsheet for web

<p align="center">
  <a href="https://github.com/myliang/x-spreadsheet">
    <img width="100%" src="https://raw.githubusercontent.com/myliang/x-spreadsheet/master/docs/demo.png">
  </a>
</p>

## Install
``` shell
npm install x-data-spreadsheet
``` 

## Quick Start
``` html
<div id="xss-demo"></div>
```

``` javascript
import Spreadsheet from 'x-data-spreadsheet';
new Spreadsheet(document.getElementById('xss-demo')).loadData({});
```

## Development
``` sheel
git clone https://github.com/myliang/x-spreadsheet.git
cd x-spreadsheet
npm install
npm run dev
```
Open your browser and visit http://127.0.0.1:8080.

## Browser Support
Modern browsers(chrome, firefox, Safari).

## LICENSE
MIT
