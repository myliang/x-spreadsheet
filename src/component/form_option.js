import { h } from './element';
import Suggest from './suggest';
import { cssPrefix } from '../config';

export default class FormOption {
  constructor(key, items, width) {
    this.key = key;
    this.width = width;
    this.items = items;
    this.input = h('input', '').css('width', width).attr('list','mylist').attr('type','search');
    this.el = h('div', `${cssPrefix}-form-options`);
    this.optionContainer = h('datalist',`${cssPrefix}-form-datalist`).attr('id', 'mylist');;
    this.items.forEach(it => {
        var option = h('option',`${cssPrefix}-form-option`);
        option.val(it);
        this.optionContainer.child(option.el);
    });
    this.el.children(
        this.input.el,
        this.optionContainer.el
    );


  }

  setItems(items){
  
    this.items = items
    var itemList = this.items.map(it => {
        var option = h('option',`${cssPrefix}-form-option`);
        option.val(it);
        return option.el;
    });
    

    const {optionContainer } = this;

    optionContainer.html('').children(...itemList);

  }

  


  val(v) {
    return this.input.val(v);
  }
}
