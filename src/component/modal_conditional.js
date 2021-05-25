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

const getFields = (values) => {
  // will be range input
  const rf = new FormField(new FormInput("120px", "E3 or E3:F12"), {
    required: true,
    pattern: /^([A-Z]{1,2}[1-9]\d*)(:[A-Z]{1,2}[1-9]\d*)?$/,
  });
  const mf = new FormField(
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
  const vf1 = new FormField(new FormInput("80px", "Number, Text, or Cell"), {
    required: true,
    pattern: /\.*/
  })
  const vf2 = new FormField(new FormInput("80px", "Number, Text, or Cell"), {
    required: true,
    pattern: /\.*/
  })
  if (values <= 0) {
    return [rf, mf]
  } else if (values === 1) {
    return [rf, mf, vf1]
  } else {
    return [rf, mf, vf1, vf2]
  }
}

export default class ModalConditional extends Modal {
  constructor(data, values) {
    
    // value input eventually here
    const fields = getFields(values)
    const title = h("h4").children('Greater Than:')
    super(`Conditional Formatting:`, [
      title,
      h("div", `${cssPrefix}-form-fields`).children(...fields.map(field => field.el)),
      h("div", `${cssPrefix}-buttons`).children(
        new Button("cancel").on("click", () => this.btnClick("cancel")),
        new Button("save", "primary").on("click", () =>
          this.btnClick("save", data)
        )
      ),
    ]);
    this.title = title
    this.mf = fields[1];
    this.rf = fields[0];
    this.vf1 = fields[2] || null
    this.vf2 = fields[3] || null
    this.change = () => {};
    this.style = styleList[0];
    this.condition = undefined;
  }

  btnClick(action, data) {
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
      if (this.vf1) {
        values.push(this.vf1.val())
      }
      if (this.vf2) {
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
    this.title.removeChild(this.title.children()[0])
    this.title.children(keyMethodMap[v].title)
    this.show();
  }

  styleSelected(style) {
    this.style = style;
  }
}
