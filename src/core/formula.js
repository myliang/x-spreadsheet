/**
  formula:
    key
    title
    render
*/
import { tf } from '../locale/locale';

const baseFormulas = [
  {
    key: 'SUM',
    title: tf('formula.sum'),
    render: ary => ary.reduce((a, b) => Number(a) + Number(b), 0),
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
    key: 'CONCAT',
    title: tf('formula.concat'),
    render: ary => ary.join(''),
  },
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
