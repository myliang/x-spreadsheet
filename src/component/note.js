import { h } from './element';
import Icon from './icon';
import { cssPrefix } from '../config';
import { bind, unbind } from './event';

export default class Notes {
    constructor(sheet) {
        // this.viewFn = viewFn
        // this.getSelectBox = getSelectBox
        this.sheet = sheet;
        
        this.updateCBs = [] // array of functions to call on update
        this.el = h('div', `${cssPrefix}-note`).on('mouseleave', () => this.hideEl()).hide()
    }

    getNote(ri, ci) {
        return this.sheet.data.comments[`${ri}-${ci}`] || ""
    }

    setNote(ri, ci, note) {
        this.sheet.data.comments[`${ri}-${ci}`] = note
        for (let cb of this.updateCBs) {
            cb(ri, ci)
        }
    }

    showNote(ri, ci, x) {
        // remove any previous children of el
        for (let child of this.el.children()) {
            this.el.removeChild(child)
        }
        const text = this.getNote(ri, ci) || ""
        this.el.children(
            h('textarea', `${cssPrefix}-notetext`)
                .on('change', (e) => this.setNote(ri, ci, e.target.value))
                .on('blur', () => {if(text === ""){this.hideEl();}})
                .children(text)
        )
        
        const { top, left, width } = x;

        //console.log("top difference %d left difference %d right difference %d ", x.top - top, x.left - left , x.width - width);

        console.log("note position %d %d %d", top, left,width);
        this.el.css('top', `${top+66}px`).css('left', `${left+60 + width+2 + 5}px`)
        this.el.show()
        this.el.children()[0].focus()
      
    }

    clearNote(ri, ci) {
        this.setNote(ri, ci, "")
    }

    hideEl() {
        if (![...this.el.children()].includes(document.activeElement)) {
            this.el.hide()
        } 
    }
}