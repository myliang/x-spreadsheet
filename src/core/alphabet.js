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
  for(let i = 0; i !== str.length; ++i) ret = 26 * ret + str.charCodeAt(i) - 64;
  return ret - 1;
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
  let xlock = false;
  let ylock = false;
  for (let i = 0; i < src.length; i += 1) {
    if(src.charAt(i) === '$') {
      if(x.length > 0) ylock = true
      else xlock = true
    } else  if (src.charAt(i) >= '0' && src.charAt(i) <= '9') {
      y += src.charAt(i);
    } else {
      x += src.charAt(i);
    }
  }

  return [indexAt(x), parseInt(y, 10) - 1, xlock, ylock];
}

/** translate XY-tag to A1-tag
 * @example x,y => B10
 * @date 2019-10-10
 * @export
 * @param {number} x
 * @param {number} y
 * @returns {tagA1}
 */
export function xy2expr(x, y, xlock, ylock) {
  const x$ = xlock ? '$' : '';
  const y$ = ylock ? '$' : '';
  return `${x$}${stringAt(x)}${y$}${y + 1}`;
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
  const [x, y, xlock, ylock] = expr2xy(src);
  if (!condition(x, y)) return src;
  return xy2expr(x + (xlock ? 0 : xn), y + (ylock ? 0 : yn), xlock, ylock);
}

export default {
  stringAt,
  indexAt,
  expr2xy,
  xy2expr,
  expr2expr,
};
