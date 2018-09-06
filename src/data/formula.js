/**
  formula:
    key
    title
    render
*/
const baseFormulas = [
  {
    key: 'SUM',
    title: 'SUM',
    render: ary => ary.reduce((a, b) => Number(a) + Number(b), 0),
  },
  {
    key: 'AVERAGE',
    title: 'AVERAGE',
    render: ary => ary.reduce((a, b) => Number(a) + Number(b), 0) / ary.length,
  },
  {
    key: 'MAX',
    title: 'MAX',
    render: ary => Math.max(...ary.map(v => Number(v))),
  },
  {
    key: 'MIN',
    title: '最小值',
    render: ary => Math.min(...ary.map(v => Number(v))),
  },
  {
    key: 'CONCAT',
    title: '字符串拼接',
    render: ary => ary.join(''),
  },
];

const formulas = (formulaAry = []) => {
  const formulaMap = {};
  baseFormulas.concat(formulaAry).forEach((f) => {
    formulaMap[f.key] = f;
  });
  return formulaMap;
};

export default {
};

export {
  formulas,
  baseFormulas,
};
