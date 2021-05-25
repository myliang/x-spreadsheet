import Modal from "./modal";
import FormInput from "./form_input";
import FormSelect from "./form_select";
import FormField from "./form_field";
import Button from "./button";
import { t } from "../locale/locale";
import { h } from "./element";
import { cssPrefix } from "../config";
import { styles } from "../core/conditionformatter";
const styleList = Object.keys(styles).map((style) => style.toString());
const keyMethodMap = {
  gt: { name: "addGreaterThan", values: 1 },
  lt: { name: "addLessThan", values: 1 },
  btw: { name: "addBetween", values: 2 },
  eq: { name: "addEqualTo", values: 1 },
  cont: { name: "addTextContains", values: 1 },
  dup: { name: "addCheckDuplicate", values: 0 },
  topx: { name: "addTopXItems", values: 1 },
  botx: { name: "addBottomXItems", values: 1 },
  topp: { name: "addTopXPercent", values: 1 },
  botp: { name: "addBottomXPercent", values: 1 },
  aavg: { name: "addAboveAverage", values: 0 },
  bavg: { name: "addBelowAverage", values: 0 },
};

export default class ModalConditional extends Modal {
  constructor(data) {
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
      { required: true }
    );
    // value input eventually here

    super(`Conditional Formatting:`, [
      h("div", `${cssPrefix}-form-fields`).children(rf.el, mf.el),
      h("div", `${cssPrefix}-buttons`).children(
        new Button("cancel").on("click", () => this.btnClick("cancel")),
        new Button("save", "primary").on("click", () =>
          this.btnClick("save", data)
        )
      ),
    ]);
    this.mf = mf;
    this.rf = rf;
    this.change = () => {};
    this.style = styleList[0];
    this.condition = undefined;
  }

  btnClick(action, data) {
    if (action === "cancel") {
      console.log("WE WERE IN", keyMethodMap[this.condition].name);
      this.hide();
    } else if (action === "save") {
      // validation eventually
      this.change("save"); // will this do anything??
      document.dispatchEvent(
        new CustomEvent("addConditional", {
          detail: {
            sheetName: "sheet2", // TODO fix mismatch in sheet names here/dataproxy
            functionName: keyMethodMap[this.condition].name,
            params: [20, 23, 1, 3, styles[this.style]],
          },
        })
      );
      this.hide();
    }
  }

  setValue(v) {
    this.condition = v;
    this.show();
  }

  styleSelected(style) {
    this.style = style;
  }
}
