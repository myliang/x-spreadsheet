/**
  formula:
    key
    title
    render
*/
/**
 * @typedef {object} Formula
 * @property {string} key
 * @property {function} title
 * @property {function} render
 */
import { tf } from '../locale/locale';
import { numberCalc } from './helper';

function isNumber(str) {
  // eslint-disable-next-line no-restricted-globals
  return !Number.isNaN(parseFloat(str)) && isFinite(str);
}




/** @type {Formula[]} */
const baseFormulas = [
  {
    key: 'SUM',
    title: tf('formula.sum'),
    render: ary => ary.flat().flat().filter(isNumber).reduce((a, b) => numberCalc('+', a, b), 0),
  },
  {
    key: 'AVERAGE',
    title: tf('formula.average'),
    render: ([...ary]) => ary.flat().flat().filter(isNumber).reduce((a, b) => Number(a) + Number(b), 0) / ary.flat().length,
  },
  {
    key: 'MAX',
    title: tf('formula.max'),
    render: ([...ary]) => Math.max(...ary.flat().flat().filter(isNumber).map(v => Number(v))),
  },
  {
    key: 'MIN',
    title: tf('formula.min'),
    render: ([...ary]) => Math.min(...ary.flat().flat().filter(isNumber).map(v => Number(v))),
  },
  {
    key: 'IF',
    title: tf('formula._if'),
    render: ([b, t, f]) => (b ? t : f),
  },
  {
    key: 'AND',
    title: tf('formula.and'),
    render: ([...ary]) => ary.flat().flat().every(it => it),
  },
  {
    key: 'OR',
    title: tf('formula.or'),
    render: ([...ary]) => ary.flat().flat().some(it => it),
  },
  {
    key: 'CONCAT',
    title: tf('formula.concat'),
    render: ([...ary]) => ary.flat().flat().join(''),
  },
  {
    key: 'PRODUCT',
    title: tf('formula.product'),
    render: ([...ary]) => ary.flat().flat().filter(isNumber).reduce((a, b) => Number(a) * Number(b),1),
  },
  {
    key: 'COUNT',
    title: tf('formula.count'),
    render: ary => ary.flat().flat().filter(isNumber).length,
  },
  {
    key: 'MOD',
    title: tf('formula.mod'),
    render: ([a,b]) => Number(a) % Number(b),
  },
  {
    key: 'POWER',
    title: tf('formula.power'),
    render: ([a,b]) => Number(a) ** Number(b),
  },
  {
    key: 'CEILING',
    title: tf('formula.ceiling'),
    render: ([a, significance]) => Math.ceil(Number(a)),
  }, 
  {
    key: 'FLOOR',
    title: tf('formula.floor'),
    render: ([a]) => Math.floor(Number(a)),
  },
  {
    key: 'LEN',
    title: tf('formula.len'),
    render: ([a]) => String(a).length,
  },
  {
    key: 'REPLACE',
    title: tf('formula.replace'),
    render: ([oldText, startNum, numChars, newText]) => {
      // Adjust the startNum from 1-based index to 0-based index for JavaScript
      const zstart = startNum - 1;

      // Get the parts of the old text to keep
      const beginning = oldText.slice(0, zstart);
      const ending = oldText.slice(zstart + numChars);

      // Build and return the final string
      return beginning + newText + ending;
    }
  },
  {
    key: 'SUBSTITUTE',
    title: tf('formula.substitute'),
    render: ([text, oldText, newText]) => String(text).replaceAll(oldText, newText)
  },
  {
    key: 'VLOOKUP',
    title: tf('formula.vlookup'),
    render: ([lookupValue, table, colIndex, rangeLookup]) => {
      console.log(lookupValue, table, colIndex, rangeLookup);
      const index = table[0].findIndex(s => s == lookupValue);
      if(index >= 0 && colIndex <= table.length) {
        const lookup = table[colIndex-1];
        const value = lookup[index];
        return value;
      }
      return "#N/A";
    },

  }
  /* support:  1 + A1 + B2 * 3
  {
    key: 'DIVIDE',
    title: tf('formula.divide'),
    render: ary => ary.reduce((a, b) => Number(a) / Number(b)),
  },
  {
    key: 'PRODUCT',
    title: tf('formula.product'),
    render: ary => ary.reduce((a, b) => Number(a) * Number(b),1),
  },
  {
    key: 'SUBTRACT',
    title: tf('formula.subtract'),
    render: ary => ary.reduce((a, b) => Number(a) - Number(b)),
  },
  */
];

const formulas = baseFormulas;

// const formulas = (formulaAry = []) => {
//   const formulaMap = {};
//   baseFormulas.concat(formulaAry).forEach((f) => {
//     formulaMap[f.key] = f;
//   });
//   return formulaMap;
// };
const formulam = {};
baseFormulas.forEach((f) => {
  formulam[f.key] = f;
});

export default {
};

export {
  formulam,
  formulas,
  baseFormulas,
};
