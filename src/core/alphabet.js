import './_.prototypes';

/** index number 2 letters
 * @example stringAt(26) ==> 'AA'
 * @date 2019-10-10
 * @export
 * @param {number} index
 * @returns {string}
 */
export function stringAt(index) {
  if (index < 0) {
    return '';
  }

  index += 1;

  let col = '';

  while (index > 0) {
    const key = parseInt(((index - 1) % 26) + 65, 10);

    col = String.fromCharCode(key) + col;
    index = parseInt((index - 1) / 26, 10);
  }
  return col;
}

/** translate letter in A1-tag to number
 * @date 2019-10-10
 * @export
 * @param {string} str "AA" in A1-tag "AA1"
 * @returns {number}
 */
export function indexAt(str) {
  if (str.length === 0) {
    return 0;
  }
  let col = 0;
  let multi = 1;
  for (let i = str.length - 1; i >= 0; i--) {
    const r = str[i];
    const ind = r.charCodeAt(0);
    const aInd = 'A'.charCodeAt(0);
    const zInd = 'Z'.charCodeAt(0);
    if (ind >= aInd && ind <= zInd) {
      col += (ind - aInd + 1) * multi;
    } else {
      return 0;
    }
    multi *= 26;
  }
  return col - 1;
}

// B10 => x,y
/** translate A1-tag to XY-tag
 * @date 2019-10-10
 * @export
 * @param {tagA1} src
 * @returns {tagXY}
 */
export function expr2xy(src) {
  let x = '';
  let y = '';
  for (let i = 0; i < src.length; i += 1) {
    if (src.charAt(i) >= '0' && src.charAt(i) <= '9') {
      y += src.charAt(i);
    } else {
      x += src.charAt(i);
    }
  }
  return [indexAt(x), parseInt(y, 10) - 1];
}

/** translate XY-tag to A1-tag
 * @example x,y => B10
 * @date 2019-10-10
 * @export
 * @param {number} x
 * @param {number} y
 * @returns {tagA1}
 */
export function xy2expr(x, y) {
  return `${stringAt(x)}${y + 1}`;
}

/** translate A1-tag src by (xn, yn)
 * @date 2019-10-10
 * @export
 * @param {tagA1} src
 * @param {number} xn
 * @param {number} yn
 * @returns {tagA1}
 */
export function expr2expr(src, xn, yn, condition = () => true) {
  if (xn === 0 && yn === 0) return src;
  const [x, y] = expr2xy(src);
  if (!condition(x, y)) return src;
  return xy2expr(x + xn, y + yn);
}

export default {
  stringAt,
  indexAt,
  expr2xy,
  xy2expr,
  expr2expr,
};
