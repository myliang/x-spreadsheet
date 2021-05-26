import Modal from "./modal";
import FormInput from "./form_input";
import FormSelect from "./form_select";
import FormField from "./form_field";
import Button from "./button";
import { t } from "../locale/locale";
import { h } from "./element";
import { cssPrefix } from "../config";
import CellRange from "../core/cell_range";
import { styles } from "../core/conditionformatter";

const styleList = Object.keys(styles).map((style) => style.toString());
export const keyMethodMap = {
  gt: { func: "addGreaterThan", title: "Greater Than:", values: 1 },
  lt: { func: "addLessThan", title: "Less Than:", values: 1 },
  btw: { func: "addBetween", title: "Between:", values: 2 },
  eq: { func: "addEqualTo", title: "Equal To:", values: 1 },
  cont: { func: "addTextContains", title: "Contains:", values: 1 },
  dup: { func: "addCheckDuplicate", title: "Duplicates:", values: 0 },
  topx: { func: "addTopXItems", title: "Top X Items:", values: 1 },
  botx: { func: "addBottomXItems", title: "Bottom X Items:", values: 1 },
  topp: { func: "addTopXPercent", title: "Top X Percent:", values: 1 },
  botp: { func: "addBottomXPercent", title: "Bottom X Percent", values: 1 },
  aavg: { func: "addAboveAverage", title: "Above Average:", values: 0 },
  bavg: { func: "addBelowAverage", title: "Below Average:", values: 0 },
};

export default class ModalConditional extends Modal {
  constructor(data) {
    const rf = new FormField(new FormInput("120px", "E3 or E3:F12"), {
      required: true,
      pattern: /^([A-Z]{1,2}[1-9]\d*)(:[A-Z]{1,2}[1-9]\d*)?$/,
    }, 'Range & Style:');
    const sf = new FormField(
      // will select style
      new FormSelect(
        styleList[0],
        styleList,
        "100%",
        (it) => t(`conditionalFormatting.style.${it}`),
        (it) => this.styleSelected(it)
      ),
      { required: true },
    );
    const vf1 = new FormField(new FormInput("130px", "Number, Text, or Cell"), {
      required: true,
      pattern: /\.*/
    }, 'Arguments:')
    const vf2 = new FormField(new FormInput("130px", "Number, Text, or Cell"), {
      required: true,
      pattern: /\.*/
    })
    
    // value input eventually here
    const args = h("div", `${cssPrefix}-form-fields`)
    const title = h("h4").children('Greater Than:')
    const detail = h("p", `${cssPrefix}-modal-detail`).children('')
    super(`Conditional Formatting:`, [
      title,
      detail,
      h("div", `${cssPrefix}-form-fields`).children(rf.el, sf.el),
      args,
      h("div", `${cssPrefix}-buttons`).children(
        new Button("cancel").on("click", () => this.btnClick("cancel")),
        new Button("save", "primary").on("click", () =>
          this.btnClick("save", data)
        )
      ),
    ]);
    this.title = title
    this.args = args
    this.detail = detail
    this.sf = sf;
    this.rf = rf;
    this.vf1 = vf1
    this.vf2 = vf2
    this.change = () => {};
    this.style = styleList[0];
    this.condition = undefined;
  }

  hide() {
    // reset args
    const achildren = [...this.args.children()]
    achildren.forEach(child => this.args.removeChild(child))
    super.hide()
  }

  btnClick(action) {
    if (action === "cancel") {
      this.hide();
    } else if (action === "save") {
      // validation eventually
      if (!this.rf.validate()) {
        return;
      }
      const { sri, eri, sci, eci } = CellRange.valueOf(this.rf.val());
      // get extra values if available
      let values = []
      const numValues = keyMethodMap[this.condition].values
      if (numValues >= 1) {
        values.push(this.vf1.val())
      }
      if (numValues === 2) {
        values.push(this.vf2.val())
      }
      this.change("save"); // does this do anything??
      document.dispatchEvent(
        new CustomEvent("addConditional", {
          detail: {
            sheetName: "sheet2", // TODO fix mismatch in sheet names here/dataproxy
            functionName: keyMethodMap[this.condition].func,
            params: [sri, eri, sci, eci, ...values, styles[this.style]],
          },
        })
      );
      this.hide();
    }
  }

  setValue(v) {
    this.condition = v;
    // reset title
    this.title.removeChild(this.title.children()[0])
    this.title.child(t(`conditionalFormatting.title.${v}`))
    // reset details
    this.detail.removeChild(this.detail.children()[0])
    this.detail.child(t(`conditionalFormatting.details.${v}`))
    // set arguments
    const values = keyMethodMap[v].values
    if (values === 1) {
      this.args.child(this.vf1.el)
    } else if (values === 2) {
      this.args.children(this.vf1.el, this.vf2.el)
    }
    this.show();
  }

  styleSelected(style) {
    this.style = style;
  }
}
