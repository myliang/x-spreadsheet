// src: include chars: [0-9], +, -, *, /
// // 9+(3-1)*3+10/2 => 9 3 1-3*+ 10 2/+
const infix2suffix = (src) => {
  const operatorStack = [];
  const stack = [];
  for (let i = 0; i < src.length; i += 1) {
    const c = src.charAt(i);
    if (c !== ' ') {
      if (c >= '0' && c <= '9') {
        stack.push(c);
      } else if (c === ')') {
        let c1 = operatorStack.pop();
        while (c1 !== '(') {
          stack.push(c1);
          c1 = operatorStack.pop();
        }
      } else {
        // priority: */ > +-
        if (operatorStack.length > 0 && (c === '+' || c === '-')) {
          const last = operatorStack[operatorStack.length - 1];
          if (last === '*' || last === '/') {
            while (operatorStack.length > 0) {
              stack.push(operatorStack.pop());
            }
          }
        }
        operatorStack.push(c);
      }
    }
  }
  while (operatorStack.length > 0) {
    stack.push(operatorStack.pop());
  }
  return stack;
};

export default {
  infix2suffix,
};
