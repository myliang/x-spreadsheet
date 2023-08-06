import numfmt from 'numfmt';
import { tf } from '../locale/locale';

// eslint-disable-next-line no-unused-vars
const formatStringRender = v => v;

// eslint-disable-next-line no-unused-vars
const formatNumberRender = (v) => {
  // match "-12.1" or "12" or "12.1"
  if (/^(-?\d*.?\d*)$/.test(v)) {
    const v1 = Number(v).toFixed(2).toString();
    const [first, ...parts] = v1.split('\\.');
    return [first.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,'), ...parts];
  }
  return v;
};

const generalFmt = numfmt('');
const textFmt = numfmt('@');
const numericFmt = numfmt('#,##0.00');
const percentFmt = numfmt('#,##0.00%');
const rmbFmt = numfmt('￥#,##0.00');
const eurFmt = numfmt('€#,##0.00');
const usdFmt = numfmt('$#,##0.00');
// TODO: take from locale
const dateFmt = numfmt('dd/mm/yyyy');
const timeFmt = numfmt('[$-F400]h:mm:ss AM/PM');
const longdateFmt = numfmt('[$-F800]dddd, mmmm dd, yyyy');


const baseFormats = [
  {
    key: 'general',
    title: tf('format.general'),
    type: 'string',
    render: generalFmt,
  },
  {
    key: 'text',
    title: tf('format.text'),
    type: 'string',
    render: textFmt,
  },
  {
    key: 'number',
    title: tf('format.number'),
    type: 'number',
    label: '1,000.12',
    render: numericFmt,
  },
  {
    key: 'percent',
    title: tf('format.percent'),
    type: 'number',
    label: '10.12%',
    render: percentFmt,
  },
  {
    key: 'rmb',
    title: tf('format.rmb'),
    type: 'number',
    label: '￥10.00',
    render: rmbFmt,
  },
  {
    key: 'usd',
    title: tf('format.usd'),
    type: 'number',
    label: '$10.00',
    render: usdFmt,
  },
  {
    key: 'eur',
    title: tf('format.eur'),
    type: 'number',
    label: '€10.00',
    render: eurFmt,
  },
  {
    key: 'date',
    title: tf('format.date'),
    type: 'date',
    label: '26/09/2008',
    render: dateFmt,
  },
  {
    key: 'time',
    title: tf('format.time'),
    type: 'date',
    label: '15:59:00',
    render: timeFmt,
  },
  // {
  //   key: 'datetime',
  //   title: tf('format.datetime'),
  //   type: 'date',
  //   label: '26/09/2008 15:59:00',
  //   render: timeFmt,
  // },
  {
    key: 'longdate',
    title: tf('format.longdate'),
    type: 'date',
    label: '24:01:00',
    render: longdateFmt,
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
