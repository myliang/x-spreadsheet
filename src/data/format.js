const formatStringRender = v => v;

const formatNumberRender = (v) => {
  if (/^(-?\d*.?\d*)$/.test(v)) {
    const v1 = Number(v).toFixed(2).toString();
    const [first, ...parts] = v1.split('\\.');
    return [first.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,'), ...parts];
  }
  return v;
};

const baseFormats = [
  {
    key: 'normal',
    title: 'Normal',
    render: formatStringRender,
  },
  {
    key: 'text',
    title: 'Text',
    render: formatStringRender,
  },
  {
    key: 'number',
    title: 'Number',
    label: '1,000.12',
    render: formatNumberRender,
  },
  {
    key: 'percent',
    title: 'Percent',
    label: '10.12%',
    render: v => `${v}%`,
  },
  {
    key: 'RMB',
    title: 'RMB',
    label: '￥10.00',
    render: v => `￥${formatNumberRender(v)}`,
  },
  {
    key: 'USD',
    title: 'USD',
    label: '$10.00',
    render: v => `$${formatNumberRender(v)}`,
  },
];

const formats = (ary = []) => {
  const map = {};
  baseFormats.concat(ary).forEach((f) => {
    map[f.key] = f;
  });
  return map;
};

export default {
};
export {
  formats,
  baseFormats,
};
