import { h } from './element';
import Icon from './icon';
import { cssPrefix } from '../config';
import { bind, unbind } from './event';

export default class Notes {
    constructor(viewFn, getSelectBox) {
        this.viewFn = viewFn
        this.getSelectBox = getSelectBox
        this.notes = {} // {"ri-ci": "comment"}
        this.updateCBs = [] // array of functions to call on update
        this.el = h('div', `${cssPrefix}-note`).on('mouseleave', () => this.hideEl()).hide()
    }

    getNote(ri, ci) {
        return this.notes[`${ri}-${ci}`] || ""
    }

    setNote(ri, ci, note) {
        this.notes[`${ri}-${ci}`] = note
        for (let cb of this.updateCBs) {
            cb(ri, ci)
        }
    }

    showNote(ri, ci) {
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
        const { top, left, width } = this.getSelectBox().getBoundingClientRect()

    
        this.el.css('top', `${top}px`).css('left', `${left + width + 5}px`)
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