import { tf } from '../locale/locale';

const formatStringRender = v => v;

const formatNumberRender = (v) => {
  if (!v) {
    return '';
  }
  // match "-12.1" or "12" or "12.1"
  if (/^(-?\d*.?\d*)$/.test(v)) {
    const v1 = Number(v).toFixed(2).toString();
    const [first, ...parts] = v1.split('\\.');
    return [first.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,'), ...parts];
  }
  return v;
};

const formatPercentRender = (v) => {
  if (!v) {
    return '';
  }
  let n = v * 100;
  if ((typeof v === 'string') && v.includes('%')) {
    n = Number(v.substring(0, v.indexOf('%')));
  }
  if (Number.isNaN(n)) {
    return v;
  }
  return `${n.toFixed(2)}%`;
};

const formatDurationRender = (v) => {
  if (!v) {
    return '';
  }
  const from = (new Date(v)).getTime();
  const then = (new Date('1990')).getTime();
  return from - then;
};

const baseFormats = [
  {
    key: 'normal',
    title: tf('format.normal'),
    type: 'string',
    render: formatStringRender,
  },
  {
    key: 'text',
    title: tf('format.text'),
    type: 'string',
    render: formatStringRender,
  },
  {
    key: 'number',
    title: tf('format.number'),
    type: 'number',
    label: '1,000.12',
    render: formatNumberRender,
  },
  {
    key: 'percent',
    title: tf('format.percent'),
    type: 'number',
    label: '10.12%',
    render: formatPercentRender,
  },
  {
    key: 'rmb',
    title: tf('format.rmb'),
    type: 'number',
    label: '￥10.00',
    render: v => `￥${formatNumberRender(v)}`,
  },
  {
    key: 'usd',
    title: tf('format.usd'),
    type: 'number',
    label: '$10.00',
    render: v => `$${formatNumberRender(v)}`,
  },
  {
    key: 'eur',
    title: tf('format.eur'),
    type: 'number',
    label: '€10.00',
    render: v => `€${formatNumberRender(v)}`,
  },
  {
    key: 'date',
    title: tf('format.date'),
    type: 'date',
    label: '2008.09.26',
    render: (v, cb) => {
      if (!v) {
        return '';
      }
      try {
        const date = new Date(v);
        const [yyyymmdd, rest] = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T');
        const [hhmmss] = rest.split('.');
        if (cb) {
          cb(`${yyyymmdd} ${hhmmss}`);
        }
        return yyyymmdd;
      } catch (err) {
        return 'Invalid Date';
      }
    },
  },
  {
    key: 'time',
    title: tf('format.time'),
    type: 'date',
    label: '15:59:00',
    render: (v) => {
      if (!v) {
        return '';
      }
      return (new Date(v)).toLocaleTimeString();
    },
  },
  {
    key: 'datetime',
    title: tf('format.datetime'),
    type: 'date',
    label: '26.09.2008 15:59:00',
    render: (v) => {
      if (!v) {
        return '';
      }
      return (new Date(v)).toLocaleString('de-DE');
    },
  },
  {
    key: 'duration',
    title: tf('format.duration'),
    type: 'date',
    label: '24:01:00',
    render: formatDurationRender,
  },
];

// const formats = (ary = []) => {
//   const map = {};
//   baseFormats.concat(ary).forEach((f) => {
//     map[f.key] = f;
//   });
//   return map;
// };
const formatm = {};
baseFormats.forEach((f) => {
  formatm[f.key] = f;
});

export default {
};
export {
  formatm,
  baseFormats,
};
