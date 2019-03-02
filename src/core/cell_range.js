import { xy2expr, expr2xy } from './alphabet';

class CellRange {
  constructor(sri, sci, eri, eci) {
    this.sri = sri;
    this.sci = sci;
    this.eri = eri;
    this.eci = eci;
  }

  set(sri, sci, eri, eci) {
    this.sri = sri;
    this.sci = sci;
    this.eri = eri;
    this.eci = eci;
  }

  multiple() {
    return this.eri - this.sri > 0 || this.eci - this.sci > 0;
  }

  // cell-index: ri, ci
  // cell-ref: A10
  includes(...args) {
    let [ri, ci] = [0, 0];
    if (args.length === 1) {
      [ri, ci] = expr2xy(args[0]);
    } else if (args.length === 2) {
      [ri, ci] = args;
    }
    const {
      sri, sci, eri, eci,
    } = this;
    return sri <= ri && ri <= eri && sci <= ci && ci <= eci;
  }

  each(cb) {
    const {
      sri, sci, eri, eci,
    } = this;
    for (let i = sri; i <= eri; i += 1) {
      for (let j = sci; j <= eci; j += 1) {
        cb(i, j);
      }
    }
  }

  // within
  within(other) {
    return this.sri >= other.sri
      && this.sci >= other.sci
      && this.eri <= other.eri
      && this.eci <= other.eci;
  }

  // disjoint
  disjoint(other) {
    return this.sri > other.eri
      || this.sci > other.eci
      || other.sri > this.eri
      || other.sci > this.eci;
  }

  // intersects
  intersects(other) {
    return this.sri <= other.eri
      && this.sci <= other.eci
      && other.sri <= this.eri
      && other.sci <= this.eci;
  }

  // union
  union(other) {
    const {
      sri, sci, eri, eci,
    } = this;
    return new CellRange(
      other.sri < sri ? other.sri : sri,
      other.sci < sci ? other.sci : sci,
      other.eri > eri ? other.eri : eri,
      other.eci > eci ? other.eci : eci,
    );
  }
  // intersection

  size() {
    return [
      this.eri - this.sri + 1,
      this.eci - this.sci + 1,
    ];
  }

  toString() {
    const {
      sri, sci, eri, eci,
    } = this;
    return `${xy2expr(sci, sri)}:${xy2expr(eci, eri)}`;
  }

  toJSON() {
    return this.toString();
  }

  equals(other) {
    return this.eri === other.eri
      && this.eci === other.eci
      && this.sri === other.sri
      && this.sci === other.sci;
  }

  static valueOf(ref) {
    // B1:B8, B1 => 1 x 1 cell range
    const refs = ref.split(':');
    const [sci, sri] = expr2xy(refs[0]);
    let [eri, eci] = [sri, sci];
    if (refs.length > 1) {
      [eci, eri] = expr2xy(refs[1]);
    }
    return new CellRange(sri, sci, eri, eci);
  }
}

export default CellRange;

export {
  CellRange,
};
