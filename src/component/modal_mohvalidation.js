import Modal from './modal';
import FormInput from './form_input';
import FormSelect from './form_select';
import FormField from './form_field';
import FormOption from './form_option';
import Button from './button';
import { t } from '../locale/locale';
import { h } from './element';
import { cssPrefix } from '../config';
import cell from '../core/cell';

const fieldLabelWidth = 100;

export default class ModalMOHValidation extends Modal {
  constructor(spread) {
    
    const attributeField = new FormField( // value should be initialized
      new FormInput('280px', '2021/22 Q2 Actual, 2021/22 Q2 Budget, ...'),
      { required: true },
      `${t('MOHValidation.attributes')}`
    );
    
    const categoryField = new FormField(
      new FormInput('280px', 'Current Assets, Liabilities, ...'),
      { required: true },
      `${t('MOHValidation.categories')}`
    );
    const typeField = new FormField(
      new FormSelect('format',
        ['format', 'value', 'relative'],
        '100%',
        it => t(`MOHValidation.type.${it}`),
        it => this.criteriaSelected(it)),
      { required: true },
      `${t('MOHValidation.validationType')}:`,
      fieldLabelWidth,
    );

    // FORMAT type operators
    const formatTypeField = new FormField(
      new FormSelect('text',
        ['text', 'number'],
        '100%',
        it => t(`MOHValidation.formatType.${it}`),
        it => this.criteriaFormatSelected(it)),
      { required: true },
      `${t('MOHValidation.params')}`
    );
    const strLenField = new FormField(
      new FormInput('140px', 'Text length ex: <5, 12 >=1'),
      { required: true },
    );
    const numLenField = new FormField(
      new FormInput('140px', 'Length before decimal'),
      { required: true },
    ).hide();
    const decLenField = new FormField(
      new FormInput('140px', 'Length after decimal'),
      { required: true },
    ).hide();
    // VALUE type operators
    const ltField = new FormField(
      new FormInput('140px', 'Maximum value of number'),
      { required: true },
      `${t('MOHValidation.params')}`,
    ).hide();
    const gtField = new FormField(
      new FormInput('140px', 'Minimum value of number'),
    ).hide();

    

    const valueField = new FormField( // operator
      new FormOption('Select Attribute',[],'160px'),
      { required: true },
    );
    // RELATIVE type operators
    const of = new FormField( // operator
      new FormSelect('be',
        ['be', 'nbe', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte'],
        '160px',
        it => t(`dataValidation.operator.${it}`),
        it => this.criteriaOperatorSelected(it)),
      { required: true },
      `${t('MOHValidation.validationType')}`,
    );
    const minvf = new FormField( // min
      new FormInput('70px', '10'),
      { required: true },
    );
    const maxvf = new FormField( // max
      new FormInput('70px', '100'),
      { required: true},
    );

    const max_value = new FormField( // operator
      new FormOption('Select Attribute',[],'160px'),
      { required: true },
    );

    const min_value = new FormField( // operator
      new FormOption('Select Attribute',[],'160px'),
      { required: true },
    );


    const vf = new FormField( // value
      new FormInput('70px', '10'),
      { required: true, type: 'number' },
    ).hide();
    const sheetField = new FormField( // sheetName
      new FormInput('70px', 'Balance Sheet'),
      { required: false, type: 'text' },
      `${t('MOHValidation.sheetLabel')}`,
    );

    super(t('contextmenu.moh-validation'), [
      h('div', `${cssPrefix}-form-fields`).children(
        attributeField.el,
      ),
      h('div', `${cssPrefix}-form-fields`).children(
        categoryField.el,
      ),
      h('div', `${cssPrefix}-form-fields`).children(
        of.el,
        min_value.el,
        max_value.el,
        valueField.el,
        sheetField.el,
        
      ),
      h('div', `${cssPrefix}-buttons`).children(
        new Button('cancel').on('click', () => this.btnClick('cancel')),
        new Button('remove').on('click', () => this.btnClick('remove')),
        new Button('save', 'primary').on('click', () => this.btnClick('save')),
      ),
    ]);

    this.attributeList = [];
    this.max_value = max_value;
    this.min_value = min_value;
    this.attributeField = attributeField;
    this.categoryField = categoryField;
    this.spread = spread;
    //this.attribute_selection = attribute_selection;
    this.valueField = valueField;
    this.cellRange = null;
    this.of = of;
    this.minvf = minvf;
    this.maxvf = maxvf;
    this.vf = vf;
    
    this.sheetField = sheetField;
    this.change = () => {};
  }

  showVf(it) {
    const hint = it === 'date' ? '2018-11-12' : '10';
    
    
    this.valueField.show();
  }

  criteriaSelected(it) {
    const {
      of,
      min_value,
      max_value,
      sheetField,
    } = this;
    // it === 'format' | 'value' | 'relative'
    if (it === 'format') {
      of.hide();
      min_value.hide();
      max_value.hide();
      
      sheetField.hide();
    } else if (it === 'value') {
      of.hide();
      min_value.hide();
      max_value.hide();
      
      sheetField.hide();
    } else if (it === 'relative') {
      of.show();
      min_value.show();
      max_value.show();
      this.valueField.hide();
      sheetField.show();
    }
    //this.attribute_selection.show();
  }

  criteriaOperatorSelected(it) {
    if (!it) return;
    const {
      min_value, max_value, vf,valueField
    } = this;
    if (it === 'be' || it === 'nbe') {
      min_value.show();
      max_value.show();
     
      valueField.hide();
    } else {
      
      //attribute_selection.show();
      valueField.show();
     
      min_value.hide();
      max_value.hide();
    }
  }

  btnClick(action) {
    console.log(this.spread.data);
    console.log(this.spread.datas);
    
    if (action === 'cancel') {
      this.hide();
    } else if (action === 'remove') {
      this.change('remove');
      this.hide();
    } else if (action === 'save') {
     
      const attr = this.attributeField.val();
      const ref = this.categoryField.val();
      const operator = this.of.val();

      let value; let type;
      if(operator === 'be' || operator === 'nbe' ){
        value = [this.min_value.val(),this.max_value.val()];
        type = (isNaN(value[0]) || isNaN(value[1])) ? 'attribute' : 'number';
      }
      else{
        value = this.valueField.val();
        type = isNaN(value) ? 'attribute' : 'number';
      }
      

      console.log( ref, operator,attr,value,type,this.max_value.val(),this.min_value.val());

      this.spread.datas[this.spread.getCurrentSheetIndex()].addGDCTValidaton(this.cellRange,type,{operator,value});
      
      
      this.hide();
    }
  }

  // adds the decriptrion of the validation applied
  // ['be', 'nbe', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte']
  addValDesc(t){
    let desc;
    let cellrange = "For " + this.cellRange.toString();
    switch(t) {
      case 'be':
        desc = "*numbers must be between " + this.min_value.val() + " and " + this.max_value.val() + "*;";
        break;
      case 'nbe':
        desc = "*numbers must not be between " + this.min_value.val() + " and " + this.max_value.val() + "*;";
        break;
      case 'eq':
        desc = "*numbers must equal to " + this.valueField.val()+ "*;";
        break;
      case 'neq':
        desc = "*numbers must NOT equal to " + this.valueField.val()+ "*;";
        break;
      case 'lt':
        desc = "*numbers must be less than " + this.valueField.val()+ "*;";
        break;
      case 'lte':
        desc = "*numbers must be less than or equal to " + this.valueField.val()+ "*;";
        break;
      case 'gt':
        desc = "*numbers must be less than " + this.valueField.val()+ "*;";
        break;
      case 'gte':
        desc = "*numbers must be greater than or equal to " + this.valueField.val() + "*;";
        break;
    }

    let rulesString = this.spread.cell(1,2);
    console.log("222");
    console.log(rulesString);
    if(rulesString == undefined){
      console.log("hi");
      this.spread.cellText(1,2,cellrange + desc);
    }else{
      this.spread.cellText(1,2,rulesString.text +'\n' +cellrange + desc);
    }

    

  }
  
  getAttributeList(){
    var attribute_data_row = this.spread.getRow(9);
    var attribute_list = []
    var a2 = []

    Object.keys(attribute_data_row).forEach((key) =>{
      
      if(this.spread.cell(0,key) != null){
        
        attribute_list.push({key: attribute_data_row[key].text , title: attribute_data_row[key].text});
        a2.push(attribute_data_row[key].text);
      }
    } );
    
    
    return a2;
  }

  //
  selectedAtrributesandCategories(cellR){
    this.cellRange = cellR;
    var attr = ""; 
    var cat = "";
    var attrs = [];
    var attribute_data_row = this.spread.getRow(9);
    console.log(attribute_data_row);
    console.log(this.spread);
    var start_col = cellR.sci;
    var end_col = cellR.eci;

    for (let i = start_col; i < end_col+1; i++) {
      if(attribute_data_row[i] != undefined){
        attr += attribute_data_row[i].text+","
        attrs.push(attribute_data_row[i].text);
      }
    }

    for(let i = cellR.sri; i < cellR.eri+1; i++){
      if(this.spread.cell(i,1) != undefined){
        cat += this.spread.cell(i,1).text+","
      }
    }

    this.attributeField.val(attr);
    this.categoryField.val(cat);

    return attrs;
  }

  prepare(cellR){
    var attrList = this.getAttributeList();
    var selectedAttr = this.selectedAtrributesandCategories(cellR);
    var nonselectedAttrs = attrList.filter(x => !(selectedAttr.includes(x)) );
    this.attributeList = attrList;
    this.valueField.input.setItems(nonselectedAttrs);
    this.min_value.input.setItems(nonselectedAttrs);
    this.max_value.input.setItems(nonselectedAttrs);
    this.valueField.input.setItems(nonselectedAttrs);

  }

  // validation: { mode, ref, validator }
  setValue(v) {
    if (v) {
      const {
        of, vf, min_value, max_value,
      } = this;
      const {
        mode, ref, validator,
      } = v;
      const {
        type, operator, value,
      } = validator || { type: 'list' };
      
      of.val(operator);
      this.criteriaSelected(type);
      console.log("lol KekW " + operator);
      this.criteriaOperatorSelected(of.val());
    }
    else{

    }
    
    this.show();
  }
}
