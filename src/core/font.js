// docs
import './_.prototypes';

/** default font list
 * @type {BaseFont[]}
 */
const baseFonts = [
  { key: 'Arial', title: 'Arial' },
  { key: 'Helvetica', title: 'Helvetica' },
  { key: 'Source Sans Pro', title: 'Source Sans Pro' },
  { key: 'Comic Sans MS', title: 'Comic Sans MS' },
  { key: 'Courier New', title: 'Courier New' },
  { key: 'Verdana', title: 'Verdana' },
  { key: 'Lato', title: 'Lato' },
];

/** default fontSize list
 * @type {FontSize[]}
 */
const fontSizes = [
  { pt: 7.5, px: 10 },
  { pt: 8, px: 11 },
  { pt: 9, px: 12 },
  { pt: 10, px: 13 },
  { pt: 10.5, px: 14 },
  { pt: 11, px: 15 },
  { pt: 12, px: 16 },
  { pt: 14, px: 18.7 },
  { pt: 15, px: 20 },
  { pt: 16, px: 21.3 },
  { pt: 18, px: 24 },
  { pt: 22, px: 29.3 },
  { pt: 24, px: 32 },
  { pt: 26, px: 34.7 },
  { pt: 36, px: 48 },
  { pt: 42, px: 56 },
  // { pt: 54, px: 71.7 },
  // { pt: 63, px: 83.7 },
  // { pt: 72, px: 95.6 },
];

/** map pt to px
 * @date 2019-10-10
 * @param {fontsizePT} pt
 * @returns {fontsizePX}
 */
function getFontSizePxByPt(pt) {
  for (let i = 0; i < fontSizes.length; i += 1) {
    const fontSize = fontSizes[i];
    if (fontSize.pt === pt) {
      return fontSize.px;
    }
  }
  return pt;
}

/** transform baseFonts to map
 * @date 2019-10-10
 * @param {BaseFont[]} [ary=[]]
 * @returns {object}
 */
function fonts(ary = []) {
  const map = {};
  baseFonts.concat(ary).forEach((f) => {
    map[f.key] = f;
  });
  return map;
}

export default {};
export {
  fontSizes,
  fonts,
  baseFonts,
  getFontSizePxByPt,
};
