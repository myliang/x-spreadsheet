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
    type: 'string',
    render: formatStringRender,
  },
  {
    key: 'text',
    title: 'Plain Text',
    type: 'string',
    render: formatStringRender,
  },
  {
    key: 'number',
    title: 'Number',
    type: 'number',
    label: '1,000.12',
    render: formatNumberRender,
  },
  {
    key: 'percent',
    title: 'Percent',
    type: 'number',
    label: '10.12%',
    render: v => `${v}%`,
  },
  {
    key: 'rmb',
    title: 'RMB',
    type: 'number',
    label: '￥10.00',
    render: v => `￥${formatNumberRender(v)}`,
  },
  {
    key: 'usd',
    title: 'USD',
    type: 'number',
    label: '$10.00',
    render: v => `$${formatNumberRender(v)}`,
  },
  {
    key: 'date',
    title: 'Date',
    type: 'string',
    label: '26/09/2008',
    render: v => `$${formatNumberRender(v)}`,
  },
  {
    key: 'time',
    title: 'Time',
    type: 'string',
    label: '15:59:00',
    render: v => `$${formatNumberRender(v)}`,
  },
  {
    key: 'datetime',
    title: 'Date time',
    type: 'string',
    label: '26/09/2008 15:59:00',
    render: v => `$${formatNumberRender(v)}`,
  },
  {
    key: 'duration',
    title: 'Duration',
    type: 'string',
    label: '24:01:00',
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
