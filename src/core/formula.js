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
import { numberCalc, mapValuesToMatrix } from './helper';

/** @type {Formula[]} */
const baseFormulas = [
  {
    key: 'SUM',
    title: tf('formula.sum'),
    render: ary => ary.reduce((a, b) => numberCalc('+', a, b), 0),
  },
  {
    key: 'AVERAGE',
    title: tf('formula.average'),
    render: ary => ary.reduce((a, b) => Number(a) + Number(b), 0) / ary.length,
  },
  {
    key: 'MAX',
    title: tf('formula.max'),
    render: ary => Math.max(...ary.map(v => Number(v))),
  },
  {
    key: 'MIN',
    title: tf('formula.min'),
    render: ary => Math.min(...ary.map(v => Number(v))),
  },
  {
    key: 'IF',
    title: tf('formula._if'),
    render: ([b, t, f]) => (b ? t : f),
  },
  {
    key: 'AND',
    title: tf('formula.and'),
    render: ary => ary.every(it => it),
  },
  {
    key: 'OR',
    title: tf('formula.or'),
    render: ary => ary.some(it => it),
  },
  {
    key: 'CONCAT',
    title: tf('formula.concat'),
    render: ary => ary.join(''),
  },
  {
    key: 'CONCATENATE',
    title: tf('formula.concatenate'),
    render: ary => ary.join(''),
  },
  {
    key: 'VLOOKUP',
    title: tf('formula.vlookup'),
    render: (ary, matrixMapping) => {
      const [loopupVal, ...values] = ary;
      const [, ...mapping] = matrixMapping;

      let colIndex = 0;

      if (Number.isNaN(parseInt(mapping.at(-1), 10))) {
        return '#N/A';
      }

      const index = values.pop();

      if (index === 0) {
        return '#VALUE!';
      }

      colIndex = index - 1;
      mapping.pop();

      const matrix = mapValuesToMatrix(mapping, values);

      const indexOfElm = matrix[0].lastIndexOf(loopupVal);
      return indexOfElm !== -1 ? matrix[colIndex][indexOfElm] : '#N/A';
    },
  },
  {
    key: 'DIVIDE',
    title: tf('formula.divide'),
    render: ary => ary.reduce((a, b) => Number(a) / Number(b)),
  },
  /* support:  1 + A1 + B2 * 3
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
