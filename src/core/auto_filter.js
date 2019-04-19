// operator: eq|neq|gt|gte|lt|lte|in|be
// value: 
//   in => []
//   be => [min, max]
class Filter {
  constructor(ci, operator, value) {
    this.ci = ci;
    this.operator = operator;
    this.value = value;
  }
}

class Sort {
  constructor(ci, desc) {
    this.ci = ci;
    this.desc = desc;
  }
}

export default class AutoFilter {
  constructor() {
    this.ref = '';
    this.filters = [];
    this.sort = null;
  }
}
