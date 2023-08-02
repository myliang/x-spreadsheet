import { expr2xy, xy2expr } from './alphabet';
import font from './font';
import { numberCalc } from './helper';

// Converting infix expression to a suffix expression
// src: AVERAGE(SUM(A1,A2), B1) + 50 + B20
// return: [A1, A2], SUM[, B1],AVERAGE,50,+,B20,+
const infixExprToSuffixExpr = (src) => {
  const operatorStack = [];
  const stack = [];
  let subStrs = []; // SUM, A1, B2, 50 ...
  let fnArgType = 0; // 1 => , 2 => :
  let fnArgOperator = '';
  let fnArgsLen = 1; // A1,A2,A3...
  let oldc = '';
  let locked = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src.charAt(i);
    if (c !== ' ') {
      // skip '$' for now
      if(c === '$') {
        locked = true;
      } else if (c >= 'a' && c <= 'z') {
        subStrs.push((locked ? "$":"") + c.toUpperCase());
      } else if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || c === '.') {
        subStrs.push((locked ? "$":"") + c);
      } else if (c === '"') {
        i += 1;
        while (src.charAt(i) !== '"') {
          subStrs.push(src.charAt(i));
          i += 1;
        }
        stack.push(`"${subStrs.join('')}`);
        subStrs = [];
      } else if (c === '-' && /[+\-*/,(]/.test(oldc)) {
        subStrs.push(c);
      } else {
        // console.log('subStrs:', subStrs.join(''), stack);
        if (c !== '(' && subStrs.length > 0) {
          stack.push(subStrs.join(''));
        }
        if (c === ')' || c === ',') {
          // let c1 = operatorStack.pop();
          if (fnArgType === 2) { // encountered a :
            // fn argument range => A1:B5
            try {
              const [ex, ey] = expr2xy(stack.pop());
              const [sx, sy] = expr2xy(stack.pop());
              // console.log('::', sx, sy, ex, ey);
              let rangelen = 0;
              let items = [];
              // TODO: what about rectangular selection
              for (let x = sx; x <= ex; x += 1) {
                for (let y = sy; y <= ey; y += 1) {
                  items.push(xy2expr(x, y));
                  rangelen += 1;
                }
              }
              stack.push(items);
              // it will be actually incremented lated
              if(c === ')') {
                let c1 = operatorStack.pop();
                stack.push({ f: c1, len: fnArgsLen});
              } else {
                fnArgType = 1;
                fnArgsLen += 1;
              }
            } catch (e) {
              // console.log(e);
            }
          } else if (fnArgType === 1 || fnArgType === 3) {
            if (fnArgType === 3) {
              stack.push(fnArgOperator);
              fnArgOperator = '';
            }
              // if (fnArgType === 1) stack.push({ f: c1, len: fnArgsLen});
            if (c === ')') {
              let c1 = operatorStack.pop();
              
              // fn argument => A1,A2,B5
              stack.push({f: c1, len: fnArgsLen});
              fnArgsLen = 1;
            } else {
              fnArgType = 1;
              fnArgsLen+=1;
            }

          } else {
            // console.log('c1:', c1, fnArgType, stack, operatorStack);
            let c1 = operatorStack.pop();
            while (c1 !== '(') {
              stack.push(c1);
              if (operatorStack.length <= 0) break;
              c1 = operatorStack.pop();
            }
          }
          if(c === ')') {
            fnArgType = 0;
          }
        } else if (c === '=' || c === '>' || c === '<') {
          const nc = src.charAt(i + 1);
          fnArgOperator = c;
          if (nc === '=' || nc === '-') {
            fnArgOperator += nc;
            i += 1;
          }
          fnArgType = 3;
        } else if (c === ':') {
          fnArgType = 2;
        } else if (c === ',') {
          // TODO: here if the previous parameter is a range, we should colllect it
          if (fnArgType === 3) {
            stack.push(fnArgOperator);
          }
          fnArgType = 1;
          fnArgsLen += 1;
        } else if (c === '(' && subStrs.length > 0) {
          // function
          operatorStack.push(subStrs.join(''));
        } else {
          // priority: */ > +-
          // console.log('xxxx:', operatorStack, c, stack);
          if (operatorStack.length > 0 && (c === '+' || c === '-')) {
            let top = operatorStack[operatorStack.length - 1];
            if (top !== '(') stack.push(operatorStack.pop());
            if (top === '*' || top === '/') {
              while (operatorStack.length > 0) {
                top = operatorStack[operatorStack.length - 1];
                if (top !== '(') stack.push(operatorStack.pop());
                else break;
              }
            }
          } else if (operatorStack.length > 0) {
            const top = operatorStack[operatorStack.length - 1];
            if (top === '*' || top === '/') stack.push(operatorStack.pop());
          }
          operatorStack.push(c);
        }
        subStrs = [];
      }
      oldc = c;
    }
  }
  if (subStrs.length > 0) {
    stack.push(subStrs.join(''));
  }
  while (operatorStack.length > 0) {
    stack.push(operatorStack.pop());
  }
  if(fnArgOperator.length>0) {
    stack.push(fnArgOperator);
  }
  return stack;
};

const evalSubExpr = (subExpr, cellRender) => {

  if(Array.isArray(subExpr)) {
    const ret = subExpr.map(e => evalSubExpr(e, cellRender));
    return ret;
  }

  const [fl] = subExpr;
  let expr = subExpr;
  if (fl === '"') {
    return subExpr.substring(1);
  }
  let ret = 1;
  if (fl === '-') {
    expr = subExpr.substring(1);
    ret = -1;
  }
  if (expr[0] >= '0' && expr[0] <= '9') {
    return ret * Number(expr);
  }
  const [x, y] = expr2xy(expr);
  // changed by gcannata
  // return ret * cellRender(x, y);
  return cellRender(x, y);
};

// evaluate the suffix expression
// srcStack: <= infixExprToSufixExpr
// formulaMap: {'SUM': {}, ...}
// cellRender: (x, y) => {}
const evalSuffixExpr = (srcStack, formulaMap, cellRender, cellList) => {
  const stack = [];
  // console.log(':::::formulaMap:', formulaMap);
  for (let i = 0; i < srcStack.length; i += 1) {
    // console.log(':::>>>', srcStack[i]);
    const expr = srcStack[i];
    const fc = expr[0];
    if (expr === '+') {
      const top = stack.pop();
      stack.push(numberCalc('+', stack.pop(), top));
    } else if (expr === '-') {
      if (stack.length === 1) {
        const top = stack.pop();
        stack.push(numberCalc('*', top, -1));
      } else {
        const top = stack.pop();
        stack.push(numberCalc('-', stack.pop(), top));
      }
    } else if (expr === '*') {
      stack.push(numberCalc('*', stack.pop(), stack.pop()));
    } else if (expr === '/') {
      const top = stack.pop();
      stack.push(numberCalc('/', stack.pop(), top));
    } else if (fc === '=' || fc === '>' || fc === '<') {
      let top = stack.pop();
      if (!Number.isNaN(top)) top = Number(top);
      let left = stack.pop();
      if (!Number.isNaN(left)) left = Number(left);
      let ret = false;
      if (fc === '=') {
        ret = (left === top);
      } else if (expr === '>') {
        ret = (left > top);
      } else if (expr === '>=') {
        ret = (left >= top);
      } else if (expr === '<') {
        ret = (left < top);
      } else if (expr === '<=') {
        ret = (left <= top);
      }
      stack.push(ret);
    } 
    // by gcannata
    // else if (Array.isArray(expr)) {
    //   const [formula, len] = expr;
    //   const params = [];
    //   for (let j = 0; j < len; j += 1) {
    //     params.push(stack.pop());
    //   }
    //   stack.push(formulaMap[formula].render(params.reverse()));
    // } 
    else if (expr.f) {
      const {f, len} = expr;
      const params = [];
      for (let j = 0; j < len; j += 1) {
        params.push(stack.pop());
      }
      stack.push(formulaMap[f].render(params.reverse()));
    } 
    else if (formulaMap[expr]) { // try to support unary operators
      const params = [];
      params.push(stack.pop());
      stack.push(formulaMap[expr].render(params));
    } else {
      if (cellList.includes(expr)) {
        return 0;
      }
      if ((fc >= 'a' && fc <= 'z') || (fc >= 'A' && fc <= 'Z')) {
        cellList.push(expr);
      }
      stack.push(evalSubExpr(expr, cellRender));
      cellList.pop();
    }
    // console.log('stack:', stack);
  }
  // by gcanata
  // return stack[0];
  return stack[0] || 0;
};

const cellRender = (src, formulaMap, getCellText, cellList = []) => {
  if (src[0] === '=') {
    const stack = infixExprToSuffixExpr(src.substring(1));
    if (stack.length <= 0) return src;
    return evalSuffixExpr(
      stack,
      formulaMap,
      (x, y) => cellRender(getCellText(x, y), formulaMap, getCellText, cellList),
      cellList,
    );
  }
  return src;
};

export default {
  render: cellRender,
};
export {
  infixExprToSuffixExpr,
};
