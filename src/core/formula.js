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
      try {
        const [lookup, ...values] = ary;
        const [, ...mapping] = matrixMapping;

        let colIndex = 0;
        let lookupValue = lookup;

        if (!Number.isNaN(Number(lookup))) {
          lookupValue = Number(lookup);
        }

        if (Number.isNaN(Number(mapping.at(-1)))) return '#N/A';

        const index = values.pop();

        if (index === 0) return '#VALUE!';

        colIndex = index - 1;
        mapping.pop();

        const matrix = mapValuesToMatrix(mapping, values);

        const indexOfElm = matrix[0].indexOf(lookupValue);
        return indexOfElm !== -1 ? matrix[colIndex][indexOfElm] : '#REF!';
      } catch (e) {
        console.error(e);
        return '#NAME?';
      }
    },
  },
  {
    key: 'SUBSTITUTE',
    title: tf('formula.substitute'),
    render: (ary) => {
      const [txt, ...rest] = ary;
      if (rest.length < 2) return '#N/A';
      let i;
      let oldTxt = '';
      let newTxt = '';
      if (rest.length === 2) {
        oldTxt = rest.at(-2).toString();
        newTxt = rest.at(-1).toString();
      } else {
        oldTxt = rest.at(-3).toString();
        newTxt = rest.at(-2).toString();
        i = rest.at(-1);
      }

      if (i && Number.isNaN(Number(i))) return '#N/A';

      const regex = new RegExp(oldTxt, 'g');
      let iteration = 0;
      const r = txt.replace(regex, (s) => {
        iteration += 1;
        if (i) {
          return iteration === Number(i) ? newTxt : s;
        }
        return newTxt;
      });
      return r;
    },
  },
  {
    key: 'LEN',
    title: tf('formula.len'),
    render: ([first]) => {
      if (!Number.isNaN(Number(first))) {
        return first.toString().length;
      }
      return first.length;
    },
  },
  {
    key: 'LEFT',
    title: tf('formula.left'),
    render: (ary) => {
      const [txt, ...rest] = ary;
      const i = rest.at(-1);
      const chars = i ? Number(i) : 1;
      if (Number.isNaN(chars)) return '#N/A';
      return txt.substring(0, chars);
    },
  },
  {
    key: 'RIGHT',
    title: tf('formula.right'),
    render: (ary) => {
      const [txt, ...rest] = ary;
      const i = rest.at(-1);
      const chars = i ? Number(i) : 1;
      if (Number.isNaN(chars)) return '#N/A';
      return txt.substring(txt.length - chars);
    },
  },
  {
    key: 'FIND',
    title: tf('formula.find'),
    render: (ary) => {
      const [txt, ...rest] = ary;
      let within = '';
      let i = 0;
      if (!rest.length) return '#N/A';
      if (rest.length === 1) {
        within = rest.at(-1).toString();
      }
      if (rest.length > 1) {
        within = rest.at(-2).toString();
        i = rest.at(-1);
      }
      if (Number.isNaN(Number(i))) return '#N/A';
      return within.indexOf(txt, Number(i)) + 1;
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
