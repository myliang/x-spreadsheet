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
  return !Number.isNaN(parseFloat(str)) && Number.isFinite(str);
}


/** @type {Formula[]} */
const baseFormulas = [
  {
    key: 'SUM',
    title: tf('formula.sum'),
    render: ([ary]) => ary.reduce((a, b) => numberCalc('+', a, b), 0),
  },
  {
    key: 'AVERAGE',
    title: tf('formula.average'),
    render: ([ary]) => ary.reduce((a, b) => Number(a) + Number(b), 0) / ary.length,
  },
  {
    key: 'MAX',
    title: tf('formula.max'),
    render: ([ary]) => Math.max(...ary.map(v => Number(v))),
  },
  {
    key: 'MIN',
    title: tf('formula.min'),
    render: ([ary]) => Math.min(...ary.map(v => Number(v))),
  },
  {
    key: 'IF',
    title: tf('formula._if'),
    render: ([b, t, f]) => (b ? t : f),
  },
  {
    key: 'AND',
    title: tf('formula.and'),
    render: ([ary]) => ary.every(it => it),
  },
  {
    key: 'OR',
    title: tf('formula.or'),
    render: ([ary]) => ary.some(it => it),
  },
  {
    key: 'CONCAT',
    title: tf('formula.concat'),
    render: ary => ary.join(''),
  },
  {
    key: 'PRODUCT',
    title: tf('formula.product'),
    render: ary => ary.reduce((a, b) => Number(a) * Number(b),1),
  },
  {
    key: 'COUNT',
    title: tf('formula.count'),
    render: ary => ary.filter(isNumber).length,
  },
  {
    key: 'MOD',
    title: tf('formula.mod'),
    render: ([a,b]) => a % b,
  },
  {
    key: 'POWER',
    title: tf('formula.power'),
    render: ([a,b]) => a ** b,
  },
  {
    key: 'CEILING',
    title: tf('formula.ceiling'),
    render: ([a]) => Math.ceil(a),
  }, 
  {
    key: 'FLOOR',
    title: tf('formula.floor'),
    render: ([a]) => Math.floor(a),
  },
  {
    key: 'LEN',
    title: tf('formula.len'),
    render: ([a]) => String(a).length
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
      console.log(arguments);
    }
    
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
