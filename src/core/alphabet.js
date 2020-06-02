import './_.prototypes';

const alphabets = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

/** index number 2 letters
 * @example stringAt(26) ==> 'AA'
 * @date 2019-10-10
 * @export
 * @param {number} index
 * @returns {string}
 */
export function stringAt(index) {
  let str = '';
  let cindex = index;
  do {
    str = alphabets[parseInt(cindex, 10) % alphabets.length] + str;
    cindex /= alphabets.length;
    cindex -= 1;
  } while (cindex >= 0);
  return str;
}

/** translate letter in A1-tag to number
 * @date 2019-10-10
 * @export
 * @param {string} str "AA" in A1-tag "AA1"
 * @returns {number}
 */
export function indexAt(str) {
  let ret = 0;
  for (let i = 0; i <= str.length - 1; i += 1) {
    const cindex = str.charCodeAt(i) - 65;
    const exponet = str.length - 1 - i;
    ret += (cindex + 1) * (alphabets.length ** exponet);
  }
  ret -= 1;
  return ret;
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
export function expr2expr(src, xn, yn) {
  const [x, y] = expr2xy(src);
  return xy2expr(x + xn, y + yn);
}

export default {
  stringAt,
  indexAt,
  expr2xy,
  xy2expr,
  expr2expr,
};
