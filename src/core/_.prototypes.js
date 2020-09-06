// font.js
/**
 * @typedef {number} fontsizePX px for fontSize
 */
/**
 * @typedef {number} fontsizePT pt for fontSize
 */
/**
 * @typedef {object} BaseFont
 * @property {string} key inner key
 * @property {string} title title for display
 */

/**
 * @typedef {object} FontSize
 * @property {fontsizePT} pt
 * @property {fontsizePX} px
 */

// alphabet.js
/**
 * @typedef {string} tagA1 A1 tag for XY-tag (0, 0)
 * @example "A1"
 */
/**
 * @typedef {string} tagA1B2 Cell reference range tag for XY-tags (0, 0) and (1, 1)
 * @example "A1:B2"
 */
/**
 * @typedef {[number, number]} tagXY
 * @example [0, 0]
 */
