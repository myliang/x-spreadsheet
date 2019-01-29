import { h } from './element';
import { cssPrefix } from '../config';

const themeColorPlaceHolders = ['#ffffff', '#000100', '#e7e5e6', '#445569', '#5b9cd6', '#ed7d31', '#a5a5a5', '#ffc001', '#4371c6', '#71ae47'];

const themeColors = [
  ['#f2f2f2', '#7f7f7f', '#d0cecf', '#d5dce4', '#deeaf6', '#fce5d5', '#ededed', '#fff2cd', '#d9e2f3', '#e3efd9'],
  ['#d8d8d8', '#595959', '#afabac', '#adb8ca', '#bdd7ee', '#f7ccac', '#dbdbdb', '#ffe59a', '#b3c6e7', '#c5e0b3'],
  ['#bfbfbf', '#3f3f3f', '#756f6f', '#8596b0', '#9cc2e6', '#f4b184', '#c9c9c9', '#fed964', '#8eaada', '#a7d08c'],
  ['#a5a5a5', '#262626', '#3a3839', '#333f4f', '#2e75b5', '#c45a10', '#7b7b7b', '#bf8e01', '#2f5596', '#538136'],
  ['#7f7f7f', '#0c0c0c', '#171516', '#222a35', '#1f4e7a', '#843c0a', '#525252', '#7e6000', '#203864', '#365624'],
];

const standardColors = ['#c00000', '#fe0000', '#fdc101', '#ffff01', '#93d051', '#00b04e', '#01b0f1', '#0170c1', '#012060', '#7030a0'];

function buildTd(bgcolor) {
  return h('td', '').child(
    h('div', `${cssPrefix}-color-palette-cell`)
      .on('click.stop', () => this.change(bgcolor))
      .css('background-color', bgcolor),
  );
}

export default class ColorPalette {
  constructor() {
    this.el = h('div', `${cssPrefix}-color-palette`);
    this.change = () => {};
    const table = h('table', '').children(
      h('tbody', '').children(
        h('tr', `${cssPrefix}-theme-color-placeholders`).children(
          ...themeColorPlaceHolders.map(color => buildTd.call(this, color)),
        ),
        ...themeColors.map(it => h('tr', `${cssPrefix}-theme-colors`).children(
          ...it.map(color => buildTd.call(this, color)),
        )),
        h('tr', `${cssPrefix}-standard-colors`).children(
          ...standardColors.map(color => buildTd.call(this, color)),
        ),
      ),
    );
    this.el.child(table);
  }
}
