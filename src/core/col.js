import helper from './helper';
import { stringAt } from '../core/alphabet';
class Cols {
    constructor({
        len, width, indexWidth, minWidth, label
    }) {
        this._ = {};
        this.len = len;
        this.width = width;
        this.indexWidth = indexWidth;
        this.minWidth = minWidth;
        this.label = label;
    }

    getHeaderText(index) {
        if (this.label) {
            if (Array.isArray(this.label)) {
                if (this.len === this.label.length) {
                    return this.label[index];
                }
            } else if (typeof (this.label) == 'function') {
                return this.label.call(this, index) || stringAt(index);
            } else if (typeof (this.label) == 'object') {
                const set = Object.assign({ start: 0, step: 1, format: undefined }, this.label);
                let val = set.start + index * (set.step || 1);
                if (set.format) {
                    val = set.format(val);
                }
                return val;
            }
        }
        return stringAt(index);
    }

    setData(d) {
        if (d.len) {
            this.len = d.len;
            delete d.len;
        }
        this._ = d;
    }

    getData() {
        const { len } = this;
        return Object.assign({ len }, this._);
    }

    getWidth(i) {
        if (this.isHide(i)) return 0;
        const col = this._[i];
        if (col && col.width) {
            return col.width;
        }
        return this.width;
    }

    getOrNew(ci) {
        this._[ci] = this._[ci] || {};
        return this._[ci];
    }

    setWidth(ci, width) {
        const col = this.getOrNew(ci);
        col.width = width;
    }

    unhide(idx) {
        let index = idx;
        while (index > 0) {
            index -= 1;
            if (this.isHide(index)) {
                this.setHide(index, false);
            } else break;
        }
    }

    isHide(ci) {
        const col = this._[ci];
        return col && col.hide;
    }

    setHide(ci, v) {
        const col = this.getOrNew(ci);
        if (v === true) col.hide = true;
        else delete col.hide;
    }

    setStyle(ci, style) {
        const col = this.getOrNew(ci);
        col.style = style;
    }

    sumWidth(min, max) {
        return helper.rangeSum(min, max, i => this.getWidth(i));
    }

    totalWidth() {
        return this.sumWidth(0, this.len);
    }
}

export default {};
export {
    Cols,
};
