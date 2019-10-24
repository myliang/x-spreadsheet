import { tf } from '../locale/locale';

const formatStringRender = v => v;

const formatNumberRender = (v,digits=2) => {
  // match "-12.1" or "12" or "12.1"
  if (/^(-?\d*.?\d*)$/.test(v)) {
    let v1;
    if(digits==2){
      v1 = Number(v).toFixed(2).toString();
    }else{
      v1 = Number(v).toFixed(digits).toString();
    }
    const [first, ...parts] = v1.split('\\.');
    return [first.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,'), ...parts];
  }
  return v;
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
    key: 'number2',
    title: tf('format.number2'),
    type: 'number',
    label: '1,000.121',
    render: v => formatNumberRender(v,3),
  },
  {
    key: 'percent',
    title: tf('format.percent'),
    type: 'number',
    label: '10.12%',
    render: v => `${v}%`,
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
    key: 'eur2',
    title: tf('format.eur2'),
    type: 'number',
    label: '€10.000',
    render: v => `€${formatNumberRender(v,3)}`,
  },
  {
    key: 'date',
    title: tf('format.date'),
    type: 'date',
    label: '26/09/2008',
    render: formatStringRender,
  },
  {
    key: 'time',
    title: tf('format.time'),
    type: 'date',
    label: '15:59:00',
    render: formatStringRender,
  },
  {
    key: 'datetime',
    title: tf('format.datetime'),
    type: 'date',
    label: '26/09/2008 15:59:00',
    render: formatStringRender,
  },
  {
    key: 'duration',
    title: tf('format.duration'),
    type: 'date',
    label: '24:01:00',
    render: formatStringRender,
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
