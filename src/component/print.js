/* global window document */
import { h } from './element';
import { cssPrefix } from '../config';
import Button from './button';
import { Draw } from '../canvas/draw';
import { renderCell } from './table';
import { t } from '../locale/locale';

// resolution: 72 => 595 x 842
// 150 => 1240 x 1754
// 200 => 1654 x 2339
// 300 => 2479 x 3508
// 96 * cm / 2.54 , 96 * cm / 2.54
let action = 0;
let pagesize = 'a4'; 
const PAGER_SIZES = [
  ['A3', 11.69, 16.54],
  ['A4', 8.27, 11.69],
  ['A5', 5.83, 8.27],
  ['B4', 9.84, 13.90],
  ['B5', 6.93, 9.84],
];

const PAGER_ORIENTATIONS = ['landscape', 'portrait'];
//Print all colums on one page
//const PAGER_MODEL = ['无打印缩放', '将整个工作表打印在一页', '将所有列打印在一页', '将所有行打印在一页'];
const PAGER_MODEL = ['none', 'Print all on one page', 'Print all colums on one page', 'Print all rows on one page'];
//const PAGER_ISPRINT = ['第 1 页', '无', '第 1 页 , 共 ? 页'];
const PAGER_ISPRINT = ['1', 'none', '1 of total'];

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
function showPageNum(evt) {
  const { value } = evt.target;
  switch (parseInt(value)) {
    case 0:
      this.showPageNum = 1;
      break;
    case 1:
      this.showPageNum = 0;
      break;
    case 2:
      this.showPageNum = 2;
      break;
    default:
      this.showPageNum = 1;
  }
  this.preview();
}

function pagerSizeChange(evt) {
  const { paper } = this;
  const { value } = evt.target;
  const ps = PAGER_SIZES[value];
  pagesize = ps[0];
  paper.w = inches2px(ps[1]);
  paper.h = inches2px(ps[2]);
  this.preview();
}
function pagerOrientationChange(evt) {
  const { paper } = this;
  const { value } = evt.target;
  const v = PAGER_ORIENTATIONS[value];
  paper.orientation = v;
  this.preview();
}
//无打印缩放
function pagerModelChange(evt) {
  const { value } = evt.target;
  switch (parseInt(value)) {
    case 2:
      this.previewNoScale();//无打印缩放
      break;
    case 1:
      this.previewScaleSheet();//将整个工作表打印在一页
      break;
    case 0:
      this.previewScaleCols();//将所有列打印在一页
      break;
    case 3:
      this.previewScaleRows();//将所有行打印在一页
      break;
    default:
      this.previewScaleCols();
  }
}

export default class Print {
  constructor(data) {
    this.showPageNum = 1;
    this.paper = {
      w: inches2px(PAGER_SIZES[0][1]),
      h: inches2px(PAGER_SIZES[0][2]),
      padding: 50,
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
                h('fieldset', '').children(
                  h('label', '').child(`${t('print.printmodel')}`),
                  h('select', '').children(
                    ...PAGER_MODEL.map((it, index) => h('option', '').attr('value', index).child(`${t('print.printmodels')[index]}`)),
                  ).on('change', pagerModelChange.bind(this)),
                ),
                h('fieldset', '').children(
                  h('label', '').child(`${t('print.showPageNumers')}`),
                  h('select', '').children(
                    ...PAGER_ISPRINT.map((it, index) => h('option', '').attr('value', index).child(it)),
                  ).on('change', showPageNum.bind(this)),
                ),
              ),
            ),
          ),
      ).hide();
  }

  resetData(data) {
    this.data = data;
  }
  // 所有列打印到一页
  previewScaleCols() {
    const { data, paper } = this;
    let { width, height, padding } = paper;
    const iwidth = width - padding * 2;
    const iheight = height - padding * 2;
    const cr = data.contentRange();
    this.canvases = [];
    action = 0;
    let scale = iwidth / cr.w;
    let ri = 0;
    let ci = 0;
    let yoffset = 0;
    let xoffset = 0;
    if (scale > 1) {
      scale = 1;
    }
    this.contentEl.html('');

    const mViewRange = {
      sri: 0,
      sci: 0,
      eri: 0,
      eci: 0,
    };
    let pageDraws = [];
    let pageRowIndexs = [];
    let pageyoffsets = [];

    let th = 0;
    const firstwrap = h('div', `${cssPrefix}-canvas-card-wraper`);
    const firstwrapCard = h('div', `${cssPrefix}-canvas-card`);
    firstwrap.css("width", (iwidth + 50 * 2 + 20 * 2) + "px");//内边距50 ，外边距20
    firstwrap.css("height", (iheight + 100) + "px");
    firstwrapCard.css("width", iwidth + "px");
    firstwrapCard.css("height", iheight + "px");
    firstwrapCard.css("padding", "50px");//预览使用，不影响打印样式

    const firstcanvas = h('canvas', `${cssPrefix}-canvas`);
    this.canvases.push(firstcanvas.el);
    const firstdraw = new Draw(firstcanvas.el, iwidth, iheight);
    if (scale < 1) firstdraw.scale(scale, scale);
    pageDraws.push(firstdraw);
    this.contentEl.child(firstwrap.child(firstwrapCard.child(firstcanvas)));
    let page = 0;
    let publicDraw = pageDraws[page];

    for (; ri <= cr.eri; ri += 1) {
      const rh = data.rows.getHeight(ri);
      th += rh;

      if (th * scale >= iheight) {
        const wrap = h('div', `${cssPrefix}-canvas-card-wraper`);
        const wrapCard = h('div', `${cssPrefix}-canvas-card`);
        wrap.css("width", (iwidth + 50 * 2 + 20 * 2) + "px");//内边距50 ，外边距20
        wrap.css("height", (iheight + 100) + "px");
        wrapCard.css("width", iwidth + "px");
        wrapCard.css("height", iheight + "px");
        wrapCard.css("padding", "50px");//预览使用，不影响打印样式

        const canvas = h('canvas', `${cssPrefix}-canvas`);
        this.canvases.push(canvas.el);
        const draw = new Draw(canvas.el, iwidth, iheight);
        if (scale < 1) draw.scale(scale, scale);
        pageDraws.push(draw);
        publicDraw = draw;
        yoffset -= th - rh;
        this.contentEl.child(wrap.child(wrapCard.child(canvas)));
        if (th * scale >= iheight) {
          pageRowIndexs.push(ri - 1);
          pageyoffsets.push(th - rh);
          th = rh;
        } else {
          pageRowIndexs.push(ri);
          pageyoffsets.push(th);
          th = 0;
        }
      }

      for (ci = 0; ci <= cr.eci; ci += 1) {
        renderCell(publicDraw, data, ri, ci, xoffset, yoffset);
      }
    }

    mViewRange.sri = 0;
    mViewRange.sci = 0; 
    let yof = 0;
    pageDraws[0].clearRect(0, pageyoffsets[0], iwidth, iheight - pageyoffsets[0] + 1);
    this.printFooter(pageDraws[0], iwidth/2 - 30, iheight, this.showPageNum, 1);
    for (let ipage = 1; ipage < pageDraws.length; ipage++) { 
      mViewRange.eci = cr.eci;
      mViewRange.eri = pageRowIndexs[ipage] == undefined ? cr.eri : pageRowIndexs[ipage];
      mViewRange.sri = pageRowIndexs[ipage - 1];
      yof -= pageyoffsets[ipage - 1];
      data.eachMergesInView(mViewRange, ({ sri, sci }) => {
        if (sri <= pageRowIndexs[ipage - 1]) {
          pageDraws[ipage].save();
          pageDraws[ipage].translate(0, yof);
          renderCell(pageDraws[ipage], data, sri, sci, 0, 0);
        }
      });
      if (ipage < pageDraws.length - 1) {
        pageDraws[ipage].restore();
        pageDraws[ipage].clearRect(0, pageyoffsets[ipage], iwidth, iheight - pageyoffsets[ipage] + 1);
      }
      this.printFooter(pageDraws[ipage], iwidth/2 - 20, iheight, this.showPageNum, ipage + 1);
    }

    this.el.show();
  }
  preview() {
    switch (action) {
      case 2:
        this.previewNoScale();//无打印缩放
        break;
      case 1:
        this.previewScaleSheet();//将整个工作表打印在一页
        break;
      case 0:
        this.previewScaleCols();//将所有列打印在一页
        break;
      case 3:
        this.previewScaleRows();//将所有行打印在一页
        break;
      default:
        this.previewScaleCols();
    }
  }
  // 所有行打印到一页
  previewScaleRows() {
    const { data, paper } = this;
    let { width, height, padding } = paper;
    const iwidth = width - padding * 2;
    const iheight = height - padding * 2;
    const cr = data.contentRange();
    this.canvases = [];
    let scale = iheight / cr.h;
    action = 3;
    let tw = 0;
    let ri = 0;
    let ci = 0;
    let yoffset = 0;
    let xoffset = 0;
    if (scale > 1) {
      scale = 1;
    }
    this.contentEl.html('');
    const mViewRange = {
      sri: 0,
      sci: 0,
      eri: 0,
      eci: 0,
    };
    let pageDraws = [];
    let pageColIndexs = [];
    let pagexoffsets = [];
    const firstwrap = h('div', `${cssPrefix}-canvas-card-wraper`);
    const firstwrapCard = h('div', `${cssPrefix}-canvas-card`);
    firstwrap.css("width", (iwidth + 50 * 2 + 20 * 2) + "px");//内边距50 ，外边距20
    firstwrap.css("height", (iheight + 100) + "px");
    firstwrapCard.css("width", iwidth + "px");
    firstwrapCard.css("height", iheight + "px");
    firstwrapCard.css("padding", "50px");//预览使用，不影响打印样式

    const firstcanvas = h('canvas', `${cssPrefix}-canvas`);
    this.canvases.push(firstcanvas.el);
    const firstdraw = new Draw(firstcanvas.el, iwidth, iheight);
    if (scale < 1) firstdraw.scale(scale, scale);
    pageDraws.push(firstdraw);
    this.contentEl.child(firstwrap.child(firstwrapCard.child(firstcanvas)));
    let page = 0;
    let publicDraw = pageDraws[page];
    for (; ri <= cr.eri; ri += 1) {
      page = 0;
      xoffset = 0;
      publicDraw = pageDraws[page];

      for (ci = 0; ci <= cr.eci; ci += 1) {
        tw += data.cols.getWidth(ci);
        if (ri == 0) {
          if (tw * scale >= iwidth) {
            const wrap = h('div', `${cssPrefix}-canvas-card-wraper`);
            const wrapCard = h('div', `${cssPrefix}-canvas-card`);
            wrap.css("width", (iwidth + 50 * 2 + 20 * 2) + "px");//内边距50 ，外边距20
            wrap.css("height", (iheight + 100) + "px");
            wrapCard.css("width", iwidth + "px");
            wrapCard.css("height", iheight + "px");
            wrapCard.css("padding", "50px");//预览使用，不影响打印样式

            const canvas = h('canvas', `${cssPrefix}-canvas`);
            this.canvases.push(canvas.el);
            const draw = new Draw(canvas.el, iwidth, iheight);
            if (scale < 1) draw.scale(scale, scale);
            pageDraws.push(draw);
            publicDraw = draw;
            xoffset -= tw - data.cols.getWidth(ci);
            this.contentEl.child(wrap.child(wrapCard.child(canvas)));
            if (tw * scale > iwidth) {
              pageColIndexs.push(ci - 1);
              pagexoffsets.push(tw - data.cols.getWidth(ci));
              tw = data.cols.getWidth(ci);
            } else {
              pageColIndexs.push(ci);
              pagexoffsets.push(tw);
              tw = 0;
            }
          }
        }
        renderCell(publicDraw, data, ri, ci, xoffset, yoffset);
        if (ci == pageColIndexs[page]) {
          page++;
          publicDraw = pageDraws[page];
          xoffset -= pagexoffsets[page - 1];
        }
      }
    }
    mViewRange.sri = 0;
    mViewRange.sci = 0;
    let xof = 0; 
    pageDraws[0].clearRect(pagexoffsets[0], 0, iwidth, iheight);
    this.printFooter(pageDraws[0], iwidth/2 - 20, iheight, this.showPageNum, 1);
    for (let ipage = 1; ipage < pageDraws.length; ipage++) {
      mViewRange.eci = pageColIndexs[ipage] == undefined ? cr.eci : pageColIndexs[ipage];
      mViewRange.eri = cr.eri;
      mViewRange.sci = pageColIndexs[ipage - 1];
      xof -= pagexoffsets[ipage - 1];
      data.eachMergesInView(mViewRange, ({ sri, sci }) => {
        if (sci <= pageColIndexs[ipage - 1]) {
          pageDraws[ipage].save();
          pageDraws[ipage].translate(xof, 0);
          renderCell(pageDraws[ipage], data, sri, sci, 0, 0);
        }
      });
      if (ipage < pageDraws.length - 1) {
        pageDraws[ipage].restore();
        pageDraws[ipage].clearRect(pagexoffsets[ipage], 0, iwidth, iheight);
      }
      this.printFooter(pageDraws[ipage], iwidth/2 - 20, iheight, this.showPageNum, ipage + 1);
    }
    this.el.show();
  }
  // 行列缩放
  previewScaleSheet() {
    const { data, paper } = this;
    let { width, height, padding } = paper;
    const iwidth = width - padding * 2;
    const iheight = height - padding * 2;
    const cr = data.contentRange();
    this.canvases = [];
    let scale = iwidth / cr.w > iheight / cr.h ? iheight / cr.h : iwidth / cr.w;
    let ri = 0;
    let ci = 0;
    action = 1;
    this.contentEl.html('');
    if (scale > 1) {
      scale = 1;
    }
    const wrap = h('div', `${cssPrefix}-canvas-card-wraper`);
    const wrapCard = h('div', `${cssPrefix}-canvas-card`);
    wrap.css("width", (iwidth + 50 * 2 + 20 * 2) + "px");//内边距50 ，外边距20
    wrap.css("height", (iheight + 100) + "px");
    wrapCard.css("width", iwidth + "px");
    wrapCard.css("height", iheight + "px");
    wrapCard.css("padding", "50px");//预览使用，不影响打印样式

    const canvas = h('canvas', `${cssPrefix}-canvas`);
    this.canvases.push(canvas.el);
    const draw = new Draw(canvas.el, iwidth, iheight);
    if (scale < 1) draw.scale(scale, scale);

    for (; ri <= cr.eri; ri += 1) {
      for (ci = 0; ci <= cr.eci; ci += 1) {
        renderCell(draw, data, ri, ci);
      }
    }
    this.contentEl.child(wrap.child(wrapCard.child(canvas)));
    this.printFooter(pageDraws[0], iwidth/2 - 20, iheight, this.showPageNum,  1);
    this.el.show();
  }
  // 无打印缩放
  previewNoScale() {
    const { data, paper } = this;
    let { width, height, padding } = paper;
    const iwidth = width - padding * 2;
    const iheight = height - padding * 2;
    const cr = data.contentRange();
    let ri = 0;
    let ci = 0;
    let th = 0;
    let tw = 0;
    let page = 0;
    action = 2;
    let yoffset = 0;
    let xoffset = 0;
    this.contentEl.html('');

    const mViewRange = {
      sri: 0,
      sci: 0,
      eri: 0,
      eci: 0,
    };
    let pageDraws = [];
    let pageRowIndexs = [];
    let pageColIndexs = [];
    let pageyoffsets = [];
    let pagexoffsets = [];

    this.canvases = [];

    const firstwrap = h('div', `${cssPrefix}-canvas-card-wraper`);
    const firstwrapCard = h('div', `${cssPrefix}-canvas-card`);
    firstwrap.css("width", (iwidth + 50 * 2 + 20 * 2) + "px");//内边距50 ，外边距20
    firstwrap.css("height", (iheight + 100) + "px");
    firstwrapCard.css("width", iwidth + "px");
    firstwrapCard.css("height", iheight + "px");
    firstwrapCard.css("padding", "50px");//预览使用，不影响打印样式

    const firstcanvas = h('canvas', `${cssPrefix}-canvas`);
    this.canvases.push(firstcanvas.el);
    const firstdraw = new Draw(firstcanvas.el, iwidth, iheight);
    pageDraws.push(firstdraw);
    this.contentEl.child(firstwrap.child(firstwrapCard.child(firstcanvas)));
    let publicDraw = pageDraws[page];
    let tmpDraw = publicDraw;
    let rIndex = 0; 
    //先打印列 后打印行
    let colpage = 0;
    for (; ri <= cr.eri; ri += 1) {
      const rh = data.rows.getHeight(ri);
      th += rh;
      tw = 0;
      colpage = 0;
      xoffset = 0;
      publicDraw = tmpDraw;
      if (th >= iheight) {
        const wrap = h('div', `${cssPrefix}-canvas-card-wraper`);
        const wrapCard = h('div', `${cssPrefix}-canvas-card`);
        wrap.css("width", (iwidth + 50 * 2 + 20 * 2) + "px");//内边距50 ，外边距20
        wrap.css("height", (iheight + 100) + "px");
        wrapCard.css("width", iwidth + "px");
        wrapCard.css("height", iheight + "px");
        wrapCard.css("padding", "50px");//预览使用，不影响打印样式

        const canvas = h('canvas', `${cssPrefix}-canvas`);
        this.canvases.push(canvas.el);
        const draw = new Draw(canvas.el, iwidth, iheight);
        pageDraws.push(draw);
        publicDraw = draw;
        tmpDraw = publicDraw;
        rIndex = pageDraws.length - 1;
        yoffset -= th - rh;
        this.contentEl.child(wrap.child(wrapCard.child(canvas)));

        for (let cols = 0; cols < pageColIndexs.length; cols++) {
          const wrap = h('div', `${cssPrefix}-canvas-card-wraper`);
          const wrapCard = h('div', `${cssPrefix}-canvas-card`);
          wrap.css("width", (iwidth + 50 * 2 + 20 * 2) + "px");//内边距50 ，外边距20
          wrap.css("height", (iheight + 100) + "px");
          wrapCard.css("width", iwidth + "px");
          wrapCard.css("height", iheight + "px");
          wrapCard.css("padding", "50px");//预览使用，不影响打印样式					

          const canvas = h('canvas', `${cssPrefix}-canvas`);
          this.canvases.push(canvas.el);
          const draw = new Draw(canvas.el, iwidth, iheight);
          pageDraws.push(draw);
          this.contentEl.child(wrap.child(wrapCard.child(canvas)));
        }

        if (th >= iheight) {
          pageRowIndexs.push(ri - 1);
          pageyoffsets.push(th - rh);
          th = rh;
        } else {
          pageRowIndexs.push(ri);
          pageyoffsets.push(th);
          th = 0;
        }
      }

      for (ci = 0; ci <= cr.eci; ci += 1) {
        tw += data.cols.getWidth(ci);
        if (ri == 0) {
          if (tw >= iwidth) {
            const wrap = h('div', `${cssPrefix}-canvas-card-wraper`);
            const wrapCard = h('div', `${cssPrefix}-canvas-card`);
            wrap.css("width", (iwidth + 50 * 2 + 20 * 2) + "px");//内边距50 ，外边距20
            wrap.css("height", (iheight + 100) + "px");
            wrapCard.css("width", iwidth + "px");
            wrapCard.css("height", iheight + "px");
            wrapCard.css("padding", "50px");//预览使用，不影响打印样式

            const canvas = h('canvas', `${cssPrefix}-canvas`);
            this.canvases.push(canvas.el);
            const draw = new Draw(canvas.el, iwidth, iheight);
            pageDraws.push(draw);
            publicDraw = draw;
            xoffset -= tw - data.cols.getWidth(ci);
            this.contentEl.child(wrap.child(wrapCard.child(canvas)));
            if (tw > iwidth) {
              pageColIndexs.push(ci - 1);
              pagexoffsets.push(tw - data.cols.getWidth(ci));
              tw = data.cols.getWidth(ci);
            } else {
              pageColIndexs.push(ci);
              pagexoffsets.push(tw);
              tw = 0;
            }
          }
        }
        renderCell(publicDraw, data, ri, ci, xoffset, yoffset);
        if (ci == pageColIndexs[colpage]) {
          colpage++;
          publicDraw = pageDraws[rIndex + colpage];
          xoffset -= pagexoffsets[colpage - 1];
        }
      }
    }

    mViewRange.sri = 0;
    mViewRange.sci = 0;
    let xof = 0;
    let yof = 0;
    pageDraws[0].clearRect(0, pageyoffsets[0], iwidth, iheight);
    pageDraws[0].clearRect(pagexoffsets[0], 0, iwidth, iheight);
    this.printFooter(pageDraws[0], iwidth/2 - 20, iheight, this.showPageNum,  1);
    let colIndex = 0;
    let rowIndex = 0;
    for (let ipage = 1; ipage < pageDraws.length; ipage++) {
      //检测列
      if (colIndex < pageColIndexs.length) {
        mViewRange.eci = pageColIndexs[colIndex + 1] == undefined ? cr.eci : pageColIndexs[colIndex + 1];
        mViewRange.eri = pageRowIndexs[rowIndex] == undefined ? cr.eri : pageRowIndexs[rowIndex];
        mViewRange.sci = pageColIndexs[colIndex];
        xof -= pagexoffsets[colIndex];

        colIndex++;
      } else if (colIndex == pageColIndexs.length && rowIndex < pageRowIndexs.length) {
        //检测行
        mViewRange.sci = 0;
        mViewRange.eci = pageColIndexs[0] == undefined ? cr.eci : pageColIndexs[0];
        mViewRange.eri = pageRowIndexs[rowIndex + 1] == undefined ? cr.eri : pageRowIndexs[rowIndex + 1];
        mViewRange.sri = pageRowIndexs[rowIndex];
        yof -= pageyoffsets[rowIndex];

        rowIndex++;
        colIndex = 0;
      }

      data.eachMergesInView(mViewRange, ({ sri, sci }) => {
        if (rowIndex > 0 && sri <= pageRowIndexs[rowIndex - 1] && sci >= mViewRange.sci) {
          pageDraws[ipage].save();
          pageDraws[ipage].translate(0, yof);
          renderCell(pageDraws[ipage], data, sri, sci, 0, 0);
        }
        if (colIndex > 0 && sci <= pageColIndexs[colIndex - 1] && sri >= mViewRange.sri) {
          pageDraws[ipage].save();
          pageDraws[ipage].translate(xof, 0);
          renderCell(pageDraws[ipage], data, sri, sci, 0, 0);
        }

      });
      if (ipage < pageDraws.length - 1) {
        pageDraws[ipage].restore();
        pageDraws[ipage].clearRect(0, pageyoffsets[ipage], iwidth, iheight);
        pageDraws[ipage].clearRect(pagexoffsets[ipage], 0, iwidth, iheight);

      }
      this.printFooter(pageDraws[ipage], iwidth/2 - 20, iheight, this.showPageNum, ipage + 1);
    }

    this.el.show();
  }

  printFooter(draw, positionX, positionY, showPageType, pagenum) {
    let isEn = t('print.numbertype') == '1' ? true : false;
    //中文页码格式
    let ctx = draw.ctx;
    ctx.font = '12px "微软雅黑"';
    ctx.fillStyle = "black";
    ctx.textBaseline = "bottom";
    let title = "";
    let totalPage = this.canvases.length;
    switch (parseInt(showPageType)) {
      case 0:
        title = "";
        break;
      case 1:
        if(isEn){
          title = pagenum;
        }else{
          title = "第" + pagenum + "页";
        }       
        break;
      case 2: 
        if(isEn){
          title = pagenum + " of " +  totalPage; 
        }else{
          title = "第" + pagenum + "页," + "共" + totalPage + "页";
        }   
        break;
      default:
        if(isEn){
          title = pagenum;
        }else{
          title = "第" + pagenum + "页";
        }   
    }
    ctx.fillText(title, positionX, positionY);
  }

  toPrint() {
    this.el.hide();
    const { paper } = this;
    const iframe = h('iframe', '').hide();
    const { el } = iframe;
    if (window.frames.length > 1) {
      window.document.body.removeChild(document.getElementsByTagName('iframe')[1]);
    }
    window.document.body.appendChild(el);
    const { contentWindow } = el;
    const idoc = contentWindow.document;
    const style = document.createElement('style');
    style.innerHTML = `
      @page { size: ${paper.orientation};};
      canvas {
        page-break-before: auto;        
        page-break-after: always;
        image-rendering: pixelated;
      };
    `;
    idoc.head.appendChild(style);
    this.canvases.forEach((it) => {
      const cn = it.cloneNode(false);
      const ctx = cn.getContext('2d');
      // ctx.imageSmoothingEnabled = true;
      ctx.drawImage(it, 0, 0);
      idoc.body.appendChild(cn);
    });
    contentWindow.print();
  }
}
