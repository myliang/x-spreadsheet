/* global window document */
import { h } from './element';
import { cssPrefix } from '../config';
import Button from './button';
import { Draw } from '../canvas/draw';
import { renderCell } from './table';
import { t } from '../locale/locale';
import printJS from "print-js";
// resolution: 72 => 595 x 842
// 150 => 1240 x 1754
// 200 => 1654 x 2339
// 300 => 2479 x 3508
// 96 * cm / 2.54 , 96 * cm / 2.54

const PAGER_SIZES = [
  ['A3', 11.69, 16.54],
  ['A4', 8.27, 11.69],
  ['A5', 5.83, 8.27],
  ['B4', 9.84, 13.90],
  ['B5', 6.93, 9.84],
];
// const PAGER_SIZES = [
//    ['A4', 11.69,8.27 ],
//   ['A3', 11.69, 16.54],
//   ['A5', 5.83, 8.27],
//   ['B4', 9.84, 13.90],
//   ['B5', 6.93, 9.84],
// ];

const PAGER_ORIENTATIONS = ['landscape', 'portrait'];

function inches2px(inc) {
  return parseInt(96 * inc, 10);
}

function btnClick(type) {
  if (type === 'cancel') {
    this.el.hide();
  } else {
    this.toPrint();
  }
}

function pagerSizeChange(evt) {
  const { paper } = this;
  const { value } = evt.target;
  const ps = PAGER_SIZES[value];
  paper.w = inches2px(ps[1]);
  paper.h = inches2px(ps[2]);
  // console.log('paper:', ps, paper);
  this.preview();
}
function pagerOrientationChange(evt) {
  const { paper } = this;
  const { value } = evt.target;
  const v = PAGER_ORIENTATIONS[value];
  paper.orientation = v;
  this.preview();
}

export default class Print {
  constructor(data) {
    this.paper = {
      w: inches2px(PAGER_SIZES[0][1]),
      h: inches2px(PAGER_SIZES[0][2]),
      leftPadding: 72.5,
      topPadding: 96,
      orientation: PAGER_ORIENTATIONS[0],
      get width() {
        return this.orientation === 'landscape' ? this.h : this.w;
      },
      get height() {
        return this.orientation === 'landscape' ? this.w : this.h;
      },
    };
    this.data = data;
    this.el = h('div', `${cssPrefix}-print`)
      .children(
        h('div', `${cssPrefix}-print-bar`)
          .children(
            h('div', '-title').child('Print settings'),
            h('div', '-right').children(
              h('div', `${cssPrefix}-buttons`).children(
                new Button('cancel').on('click', btnClick.bind(this, 'cancel')),
                new Button('next', 'primary').on('click', btnClick.bind(this, 'next')),
              ),
            ),
          ),
        h('div', `${cssPrefix}-print-content`)
          .children(
            this.contentEl = h('div', '-content'),
            h('div', '-sider').child(
              h('form', '').children(
                h('fieldset', '').children(
                  h('label', '').child(`${t('print.size')}`),
                  h('select', '').children(
                    ...PAGER_SIZES.map((it, index) => h('option', '').attr('value', index).child(`${it[0]} ( ${it[1]}''x${it[2]}'' )`)),
                  ).on('change', pagerSizeChange.bind(this)),
                ),
                h('fieldset', '').children(
                  h('label', '').child(`${t('print.orientation')}`),
                  h('select', '').children(
                    ...PAGER_ORIENTATIONS.map((it, index) => h('option', '').attr('value', index).child(`${t('print.orientations')[index]}`)),
                  ).on('change', pagerOrientationChange.bind(this)),
                ),
              ),
            ),
          ),
      ).hide();
  }

  resetData(data) {
    this.data = data;
  }

  // previewOrigin() {
  //   const { data, paper } = this;
  //   const {
  //     width, height, leftPadding, topPadding,
  //   } = paper;
  //   const iwidth = width - leftPadding * 2;
  //   const iheight = height - topPadding * 2;
  //   const cr = data.contentRange();
  //   // const pages = parseInt(cr.h / iheight, 10) + 1;
  //   // const rowPages = parseInt(cr.w / iwidth, 10) + 1;
  //   // const scale = iwidth / cr.w;
  //   const left = leftPadding;
  //   const top = topPadding;
  //   // if (scale > 1) {
  //   //   left += (iwidth - cr.w) / 2;
  //   // }
  //   let ri = 0;
  //   let yoffset = 0;
  //   let xoffset = 0;
  //   this.contentEl.html('');
  //   this.canvases = [];
  //   const mViewRange = {
  //     sri: 0,
  //     sci: 0,
  //     eri: 0,
  //     eci: 0,
  //   };
  //   // 横向分页
  //   let start = cr.sri;
  //   const rowPageSplit = [];
  //   const rowLen = [];
  //   while (data.cols.sumWidth(0, rowPageSplit.at(-1)) < cr.w) {
  //     for (let i = start + 1; ; i += 1) {
  //       if (data.cols.sumWidth(start, i) > iwidth) {
  //         // console.log("lupin 横向分页3", start, i, data.cols.sumWidth(start, i))
  //         // 更新下一页的起点
  //         if ((i - start) !== 1) {
  //           rowLen.push(data.cols.sumWidth(start, i - 1));
  //           start = i - 1;
  //         } else {
  //           rowLen.push(data.cols.sumWidth(start, i));
  //         }
  //         rowPageSplit.push(start);
  //         break;
  //       }
  //     }
  //   }
  //   // console.log('lupin print', rowPageSplit, rowLen)
  //   const alist = [0, ...rowPageSplit];
  //   // 横向分页结束
  //   // 纵向分页
  //   start = cr.sci;
  //   const colPageSplit = [];
  //   const colLen = [];
  //   while (data.rows.sumHeight(0, colPageSplit.at(-1)) < cr.h) {
  //     for (let i = start + 1; ; i += 1) {
  //       // console.log("lupin 纵向分页3", start, i, rows.sumHeight(start, i))
  //       if (data.rows.sumHeight(start, i) > iheight) {
  //         // 更新下一页的起点
  //         if ((i - start) !== 1) {
  //           colLen.push(data.rows.sumHeight(start, i - 1));
  //           start = i - 1;
  //         } else {
  //           colLen.push(data.rows.sumHeight(start, i));
  //         }
  //         colPageSplit.push(start);
  //         break;
  //       }
  //     }
  //   }
  //   // console.log("lupin odiso222",rowPageSplit,rowLen,iwidth)
  //   // 纵向分页结束
  //   for (let j = 0; j < rowPageSplit.length; j += 1) {
  //     // console.log("lupin what", j,xoffset, yoffset)
  //     ri = 0;
  //     mViewRange.sri = ri;
  //     yoffset = 0;
  //     for (let i = 0; i < colPageSplit.length; i += 1) {
  //       let th = 0;
  //       let yo = 0;
  //       const wrap = h('div', `${cssPrefix}-canvas-card`);
  //       const canvas = h('canvas', `${cssPrefix}-canvas`);
  //       this.canvases.push(canvas.el);
  //       // const draw = new Draw(canvas.el, rowLen[j]+ left*2, colLen[i]+top*3);
  //       const draw = new Draw(canvas.el, width, height);
  //       draw.clear();
  //       // cell-content
  //       draw.save();

  //       // console.log("lupin xoffset",xoffset)
  //       // lupin
  //       draw.translate(left, top);
  //       // draw.line([0, 0], [iwidth,0 ]);
  //       // draw.line([0, 0], [0, iheight]);
  //       // draw.line([0, iheight], [iwidth,iheight ]);
  //       // draw.line([iwidth, 0], [iwidth, iheight]);
  //       // lupin
  //       // const scale = iwidth/rowLen[j]
  //       // draw.scale(scale, 1);
  //       // if (scale < 1) draw.scale(scale, scale);
  //       // console.log('lupin ri:', ri, cr.eri, yoffset);
  //       for (; ri <= cr.eri; ri += 1) {
  //         const rh = data.rows.getHeight(ri);
  //         th += rh;
  //         if (th < iheight) {
  //           // console.log('lupin ri: dont push', ri, colPageSplit[i]);
  //           for (let ci = alist[j]; ci < rowPageSplit[j]; ci += 1) {
  //             //  console.log('lupin ci: dont push', ci, rowPageSplit[j]);
  //             renderCell(draw, data, ri, ci, yoffset, xoffset);
  //           }
  //         } else {
  //           yo = -(th - rh);
  //           break;
  //         }
  //       }
  //       mViewRange.eci = rowPageSplit[j] - 1;
  //       mViewRange.sci = alist[j];
  //       mViewRange.eri = ri - 1;
  //       draw.restore();
  //       // merge-cell
  //       draw.save();
  //       // lupin
  //       draw.translate(left, top);
  //       // lupin
  //       // draw.scale(scale, 1);
  //       // if (scale < 1) draw.scale(scale, scale);
  //       const yof = yoffset;
  //       const xof = xoffset;
  //       // console.log("lupin ohmy",mViewRange)
  //       data.eachMergesInView(mViewRange, ({ sri, sci }) => {
  //         // console.log("lupin shiaugdajksh",sri, sci, yof,xoffset)
  //         renderCell(draw, data, sri, sci, yof, xof);
  //       });
  //       draw.clearRect(rowLen[j], 0, width - rowLen[j] - left, height);
  //       draw.clearRect(-left, 0, left, height);
  //       draw.restore();

  //       mViewRange.sri = ri;
  //       // mViewRange.sci = mViewRange.eci;
  //       yoffset += yo;
  //       this.contentEl.child(h('div', `${cssPrefix}-canvas-card-wraper`).child(wrap.child(canvas)));
  //     }
  //     xoffset -= rowLen[j];
  //   }

  //   this.el.show();
  // }

  // toPrintOrigin() {
  //   this.el.hide();
  //   const { paper } = this;
  //   const iframe = h('iframe', '').hide();
  //   const { el } = iframe;
  //   // console.log("el", el)
  //   window.document.body.appendChild(el);
  //   const { contentWindow } = el;
  //   const idoc = contentWindow.document;
  //   const style = document.createElement('style');
  //   style.innerHTML = `
  //     @page { size: ${paper.width}px ${paper.height}px;margin:0mm};
  //     canvas {
  //       page-break-before: auto;        
  //       page-break-after: always;
  //       image-rendering: pixelated;
  //     };
  //   `;
  //   idoc.head.appendChild(style);
  //   this.canvases.forEach((it) => {
  //     const cn = it.cloneNode(false);
  //     const ctx = cn.getContext('2d');
  //     // ctx.imageSmoothingEnabled = true;
  //     ctx.drawImage(it, 0, 0);
  //     idoc.body.appendChild(cn);
  //   });
  //   contentWindow.print();
  //   // let urls =[]
  //   // this.canvases.forEach((it) => {
  //   //   const url = it.toDataURL("image/png")
  //   //   // console.log('lupin',it,url)
  //   //   urls.push(url)
  //   // });
  //   // printJS({
  //   //   printable: urls,
  //   //   type: 'image',
  //   //   documentTitle: "", 
  //   //    })
  // }
  preview() {
    let imageScale = 3
    const { data, paper } = this;
    let {
      width, height, leftPadding, topPadding,
    } = paper;
    const iwidth = width - leftPadding * 2;
    const iheight = height - topPadding * 2;
    const cr = data.contentRange();
    // const pages = parseInt(cr.h / iheight, 10) + 1;
    // const rowPages = parseInt(cr.w / iwidth, 10) + 1;
    // const scale = iwidth / cr.w;
    const left = leftPadding;
    const top = topPadding;
    // if (scale > 1) {
    //   left += (iwidth - cr.w) / 2;
    // }
    let ri = 0;
    let yoffset = 0;
    let xoffset = 0;
    this.contentEl.html('');
    this.canvases = [];
    const mViewRange = {
      sri: 0,
      sci: 0,
      eri: 0,
      eci: 0,
    };
    // 横向分页
    let start = cr.sri;
    const rowPageSplit = [];
    const rowLen = [];
    while (data.cols.sumWidth(0, rowPageSplit.at(-1)) < cr.w) {
      for (let i = start + 1; ; i += 1) {
        if (data.cols.sumWidth(start, i) > iwidth) {
          // console.log("lupin 横向分页3", start, i, data.cols.sumWidth(start, i))
          // 更新下一页的起点
          if ((i - start) !== 1) {
            rowLen.push(data.cols.sumWidth(start, i - 1));
            start = i - 1;
          } else {
            rowLen.push(data.cols.sumWidth(start, i));
          }
          rowPageSplit.push(start);
          break;
        }
      }
    }
    // console.log('lupin print', rowPageSplit, rowLen)
    const alist = [0, ...rowPageSplit];
    // 横向分页结束
    // 纵向分页
    start = cr.sci;
    const colPageSplit = [];
    while (data.rows.sumHeight(0, colPageSplit.at(-1)) < cr.h) {
      for (let i = start + 1; ; i += 1) {
        // console.log("lupin 纵向分页3", start, i, rows.sumHeight(start, i))
        if (data.rows.sumHeight(start, i) > iheight) {
          // 更新下一页的起点
          if ((i - start) !== 1) {
            start = i - 1;
          }
          colPageSplit.push(start);
          break;
        }
      }
    }
    // console.log("lupin odiso222",rowPageSplit,rowLen,iwidth)
    // 纵向分页结束
    for (let j = 0; j < rowPageSplit.length; j += 1) {
      // console.log("lupin what", j,xoffset, yoffset)
      ri = 0;
      mViewRange.sri = ri;
      yoffset = 0;
      for (let i = 0; i < colPageSplit.length; i += 1) {
        let th = 0;
        let yo = 0;
        const wrap = h('div', `${cssPrefix}-canvas-card`);

        // 打印的canvas 画质高
        const canvas = h('canvas', `${cssPrefix}-canvas`);
        this.canvases.push(canvas.el);
        // const draw = new Draw(canvas.el, rowLen[j]+ left*2, colLen[i]+top*3);
        const draw = new Draw(canvas.el, width * imageScale, height * imageScale);
        draw.clear();
        // cell-content
        draw.save();

        // console.log("lupin xoffset",xoffset)
        // lupin
        draw.translate(left * imageScale, top * imageScale);
        // draw.line([0, 0], [iwidth,0 ]);
        // draw.line([0, 0], [0, iheight]);
        // draw.line([0, iheight], [iwidth,iheight ]);
        // draw.line([iwidth, 0], [iwidth, iheight]);
        // lupin
        // const scale = iwidth/rowLen[j]
        // draw.scale(scale, 1);
        draw.scale(imageScale, imageScale);
        // if (scale < 1) draw.scale(scale, scale);
        // console.log('lupin ri:', ri, cr.eri, yoffset);
        for (; ri <= cr.eri; ri += 1) {
          const rh = data.rows.getHeight(ri);
          th += rh;
          if (th < iheight) {
            // console.log('lupin ri: dont push', ri, colPageSplit[i]);
            for (let ci = alist[j]; ci < rowPageSplit[j]; ci += 1) {
              //  console.log('lupin ci: dont push', ci, rowPageSplit[j]);
              renderCell(draw, data, ri, ci, yoffset, xoffset);
            }
          } else {
            yo = -(th - rh);
            break;
          }
        }
        mViewRange.eci = rowPageSplit[j] - 1;
        mViewRange.sci = alist[j];
        mViewRange.eri = ri - 1;
        draw.restore();
        // merge-cell
        draw.save();
        // lupin
        draw.translate(left * imageScale, top * imageScale);
        // lupin
        // draw.scale(scale, 1);
        draw.scale(imageScale, imageScale);
        // if (scale < 1) draw.scale(scale, scale);
        const yof = yoffset;
        const xof = xoffset;
        // console.log("lupin ohmy",mViewRange)
        data.eachMergesInView(mViewRange, ({ sri, sci }) => {
          // console.log("lupin shiaugdajksh",sri, sci, yof,xoffset)
          renderCell(draw, data, sri, sci, yof, xof);
        });
        draw.clearRect(rowLen[j], 0, (width - rowLen[j] - left), height);
        draw.clearRect(-left, 0, left, height);
        draw.restore();

        mViewRange.sri = ri;
        // mViewRange.sci = mViewRange.eci;
        yoffset += yo;

        //预览的canvas 画质低
        const canvas2 = h('canvas', `${cssPrefix}-canvas`);
        let it = canvas.el
        const orig_src = it.toDataURL("image/png")
        const img = h('img').attr('src', orig_src);

        const cn = it.cloneNode(true);
        cn.style.width = `${width}px`;
        cn.style.height = `${height}px`;
        cn.width = width
        cn.height = height
        const ctx = cn.getContext('2d');
        img.el.onload = function () {
          ctx.drawImage(img.el, 0, 0, width, height);
        }

        canvas2.el = cn
        this.contentEl.child(h('div', `${cssPrefix}-canvas-card-wraper`).child(wrap.child(canvas2)));
      }
      xoffset -= rowLen[j];
    }

    this.el.show();
  }
  toPrint() {
    this.el.hide();
    // const { paper } = this;
    // const iframe = h('iframe', '').hide();
    // const { el } = iframe;
    // // console.log("el", el)
    // window.document.body.appendChild(el);
    // const { contentWindow } = el;
    // const idoc = contentWindow.document;
    // const style = document.createElement('style');
    // style.innerHTML = `
    //   @page { size: ${paper.width}px ${paper.height}px;margin:0mm};
    //   canvas {
    //     page-break-before: auto;        
    //     page-break-after: always;
    //     image-rendering: pixelated;
    //   };
    // `;
    // idoc.head.appendChild(style);
    // this.canvases.forEach((it) => {
    //   const cn = it.cloneNode(false);
    //   const ctx = cn.getContext('2d');
    //   // ctx.imageSmoothingEnabled = true;
    //   ctx.drawImage(it, 0, 0);
    //   idoc.body.appendChild(cn);
    // });
    // contentWindow.print();
    let urls = []
    this.canvases.forEach((it) => {
      const url = it.toDataURL("image/png")
      // console.log('lupin',it,url)
      urls.push(url)
    });
    printJS({
      printable: urls,
      type: 'image',
      targetStyle: {
        width: this.width + 'px',
        height: this.height + 'px'
      },
      style: "@page {margin:0mm 0mm}", //去除页眉页脚
    })
  }
}
