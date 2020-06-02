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
  // Each loop iteration converts a base-26 (alphabet length) digit to a
  // character [A-Z]. Because it works from least to most significant digit,
  // each new character must be added to the FRONT of the string being built.
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
  // Each loop iteration converts a digit from a base-26 [A-Z] string to a
  // base 10 integer, working from most to least significant base-26 digit.
  for (let i = 0; i < str.length; i += 1) {
    // Calculate offset from 'A', which has character code 65
    const cindex = str.charCodeAt(i) - 65;
    const exponet = str.length - 1 - i;
    // 'A' is interpreted as 0 when in the 0th digit, but as 1 when in any
    // other digit. Therefore, we will increment cindex so that [0-25] is
    // remapped to [1-26] for all digits, then decrement the result after the
    // loop completes by 1 to remap the 0th digit back to [0-25].
    // For example:
    // 'AA' will be converted to (base-26) 11 by the loop,
    // then decremented to (base-26) 10 before being returned,
    // which expressed in base-10 is 26.
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
