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
  while (cindex >= alphabets.length) {
    cindex /= alphabets.length;
    cindex -= 1;
    str += alphabets[parseInt(cindex, 10) % alphabets.length];
  }
  const last = index % alphabets.length;
  str += alphabets[last];
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
  for (let i = 0; i < str.length - 1; i += 1) {
    const cindex = str.charCodeAt(i) - 65;
    const exponet = str.length - 1 - i;
    ret += (alphabets.length ** exponet) + (alphabets.length * cindex);
  }
  ret += str.charCodeAt(str.length - 1) - 65;
  return ret;
}

// Regex looks for:
// [1] Optional $ (absolute X symbol)
// [2] 1-3 letters representing the column (X)
// [3] Optional $ (absolute Y symbol)
// [4] Sequence of digits representing the row (Y), first digit cannot be 0
export const REGEX_EXPR_GLOBAL             = /[$]?[a-zA-Z]{1,3}[$]?[1-9][0-9]*/g;
export const REGEX_EXPR_NONGLOBAL_AT_START = /^[$]?[a-zA-Z]{1,3}[$]?[1-9][0-9]*/;
       const REGEX_EXPR_NONGLOBAL_CAPTURE  = /([$])?([a-zA-Z]{1,3})([$])?([1-9][0-9]*)/;

// B10 => x,y,xIsAbsolute,yIsAbsolute
/** translate A1-tag to XY-tag
 * @date 2019-10-10
 * @export
 * @param {tagA1} src
 * @returns {tagXY}
 */
export function expr2xy(src) {
  // Regex looks for:
  // [1] Optional $ (absolute X symbol)
  // [2] 1-3 letters representing the column (X)
  // [3] Optional $ (absolute Y symbol)
  // [4] Sequence of digits representing the row (Y)
  const found = src.match(REGEX_EXPR_NONGLOBAL_CAPTURE);

  if (!found) {
    return null;
  }

  const xIsAbsolute = found[1] !== undefined;
  const x = found[2];
  const yIsAbsolute = found[3] !== undefined;
  const y = found[4];

  return [indexAt(x), parseInt(y, 10) - 1, xIsAbsolute, yIsAbsolute];
}

/** translate XY-tag to A1-tag
 * @example x,y => B10
 * @date 2019-10-10
 * @export
 * @param {number} x
 * @param {number} y
 * @returns {tagA1}
 */
export function xy2expr(x, y, xIsAbsolute = false, yIsAbsolute = false) {
  const insertAbs = function(isAbsolute) { return (isAbsolute) ? '$' : '' };
  return `${insertAbs(xIsAbsolute)}${stringAt(x)}${insertAbs(yIsAbsolute)}${y + 1}`;
}

/** translate A1-tag src by (xn, yn)
 * @date 2019-10-10
 * @export
 * @param {tagA1} src
 * @param {number} xn
 * @param {number} yn
 * @param {Boolean} dontTranslateAbsolute
 * @returns {tagA1}
 */
export function expr2expr(src, xn, yn, translateAbsolute = false, condition = () => true) {
  if (xn === 0 && yn === 0) return src;
  const [x, y, xIsAbsolute, yIsAbsolute] = expr2xy(src);

  if (!translateAbsolute) {
    // Ignore translation request if axis is absolute
    if (xIsAbsolute) xn = 0;
    if (yIsAbsolute) yn = 0;
  }

  if (!condition(x, y)) return src;
  return xy2expr(x + xn, y + yn, xIsAbsolute, yIsAbsolute);
}

export default {
  stringAt,
  indexAt,
  expr2xy,
  xy2expr,
  expr2expr,
  REGEX_EXPR_GLOBAL,
  REGEX_EXPR_NONGLOBAL_AT_START,
};
