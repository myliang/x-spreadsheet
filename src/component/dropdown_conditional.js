import Dropdown from "./dropdown";
import { h } from "./element";
import { cssPrefix } from "../config";
import Icon from "./icon";

// hardcoded for now
const options = [
  { key: "gt", title: "Greater Than" },
  { key: "lt", title: "Less Than" },
  { key: "btw", title: "Between" },
  { key: "var", title: "Variance" },
  { key: "eq", title: "Equals" },
  { key: "cont", title: "Contains" },
  { key: "dup", title: "Duplicates" },
  { key: "topx", title: "Top X Items" },
  { key: "topp", title: "Top X Percent" },
  { key: "botx", title: "Bottom X Items" },
  { key: "botp", title: "Bottom X Percent" },
  { key: "aavg", title: "Above Average" },
  { key: "bavg", title: "Below Average" },
];

export default class DropdownConditional extends Dropdown {
  constructor() {
    const nconditions = options.map((it) =>
      h("div", `${cssPrefix}-item`)
        .on("click", () => {
          this.change(it);
        })
        .child(it.title)
    );
    super(new Icon("chart"), "160px", true, "bottom-left", ...nconditions);
  }
}
