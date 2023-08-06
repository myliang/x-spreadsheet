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

const generalFmt = ``;
const textFmt = '@';
const numericFmt = '#,##0.00';
const percentFmt = '#,##0.00%';
const rmbFmt = '￥#,##0.00';
const usdFmt = '$#,##0.00';
const eurFmt = '€#,##0.00';
// TODO: take from locale
const dateFmt = tf('format.dateformat')() || 'yyyy-mm-dd';
const timeFmt = '[$-F400]h:mm:ss AM/PM';
const longdateFmt = '[$-F800]dddd, mmmm dd, yyyy';


const baseFormats = [
  {
    // key: 'general',
    numfmt: generalFmt,
    title: tf('format.general'),
    type: 'string',
    render: numfmt(generalFmt),
  },
  {
    // key: 'text',
    numfmt: textFmt,
    title: tf('format.text'),
    type: 'string',
    render: numfmt(textFmt),
  },
  {
    // key: 'number',
    numfmt: numericFmt,
    title: tf('format.number'),
    type: 'number',
    label: '1,000.12',
    render: numfmt(numericFmt),
  },
  {
    // key: 'percent',
    numfmt: percentFmt,
    title: tf('format.percent'),
    type: 'number',
    label: '10.12%',
    render: numfmt(percentFmt),
  },
  {
    // key: 'rmb',
    numfmt: rmbFmt,
    title: tf('format.rmb'),
    type: 'number',
    label: '￥10.00',
    render: numfmt(rmbFmt),
  },
  {
    // key: 'usd',
    numfmt: usdFmt,
    title: tf('format.usd'),
    type: 'number',
    label: '$10.00',
    render: numfmt(usdFmt),
  },
  {
    // key: 'eur',
    numfmt: eurFmt,
    title: tf('format.eur'),
    type: 'number',
    label: '€10.00',
    render: numfmt(eurFmt),
  },
  {
    // key: 'date',
    numfmt: dateFmt,
    title: tf('format.date'),
    type: 'date',
    label: '26/09/2008',
    render: numfmt(dateFmt),
  },
  {
    // key: 'time',
    numfmt: timeFmt,
    title: tf('format.time'),
    type: 'date',
    label: '15:59:00',
    render: numfmt(timeFmt),
  },
  // {
  //   key: 'datetime',
  //   title: tf('format.datetime'),
  //   type: 'date',
  //   label: '26/09/2008 15:59:00',
  //   render: timeFmt,
  // },
  {
    // key: 'longdate',
    numfmt: longdateFmt,
    title: tf('format.longdate'),
    type: 'date',
    label: '24:01:00',
    render: numfmt(longdateFmt),
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

const numfmtCache = new Map();

formatm.render = (format, cellText) => {
  const p = numfmt.parseValue(cellText);

  const v = (p && p.v) || cellText;
  // if (p) {
  //   const { v } = p;
  //   // console.log(data.formatm, '>>', cell.format);
  //   cellText = formatm[style.format].render(v);
  // }
  let f;
  if (formatm[format]) {
    f = formatm[format].render;
  } else if (numfmtCache.has(format)) {
    f = numfmtCache.get(format);
  } else {
    f = numfmt(format);
    numfmtCache.set(format, f);
  }
  return f(v);
};

export default {
};
export {
  formatm,
  baseFormats,
};
