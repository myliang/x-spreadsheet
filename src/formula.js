/**
  formula:
    key
    title
    render
*/
const baseFormulas = [
  {
    key: 'SUM',
    title: '求和',
    render: ary => ary.reduce((a, b) => Number(a) + Number(b), 0),
  },
  {
    key: 'AVERAGE',
    title: '求平均值',
    render: ary => ary.reduce((a, b) => Number(a) + Number(b), 0) / ary.length,
  },
  {
    key: 'MAX',
    title: '最大值',
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
