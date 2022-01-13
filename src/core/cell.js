import { expr2xy, xy2expr } from './alphabet';
import { numberCalc } from './helper';

// Converting infix expression to a suffix expression
// src: AVERAGE(SUM(A1,A2), B1) + 50 + B20
// return: [A1, A2], SUM[, B1],AVERAGE,50,+,B20,+
const infixExprToSuffixExpr = (src) => {
  let source = src;
  const operatorStack = [];
  const stack = [];
  let subStrs = []; // SUM, A1, B2, 50 ...
  let fnArgType = 0; // 1 => , 2 => :
  let fnArgOperator = '';
  let fnArgsLen = 1; // A1,A2,A3...
  let oldc = '';

  const xSheetMap = [];
  if (source.includes('!')) {
    const sheetRgx = /(?<=\(|;|,)(?:(?!;).)*(?<=!)/g;
    const cellRgx = /(?<=!)(.*?)(?=\)|;|,)/g;
    const sMatch = source.match(sheetRgx);
    const cMatch = source.match(cellRgx);
    for (let i = 0; i < sMatch.length; i += 1) {
      const sheet = sMatch[i].replace('!', '');
      if (cMatch[i].includes(':')) {
        const [start, end] = cMatch[i].split(':');

        const [ex, ey] = expr2xy(end);
        const [sx, sy] = expr2xy(start);

        for (let x = sx; x <= ex; x += 1) {
          for (let y = sy; y <= ey; y += 1) {
            xSheetMap.push({ sheet, cell: xy2expr(x, y) });
          }
        }
      } else {
        xSheetMap.push({ sheet, cell: cMatch[i] });
      }
    }
    source = source.replace(sheetRgx, '');
  }

  for (let i = 0; i < source.length; i += 1) {
    const c = source.charAt(i);
    if (c !== ' ') {
      if (c >= 'a' && c <= 'z') {
        subStrs.push(c.toUpperCase());
      } else if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || c === '.') {
        subStrs.push(c);
      } else if (c === '"') {
        i += 1;
        while (source.charAt(i) !== '"') {
          subStrs.push(source.charAt(i));
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
        if (c === ')') {
          let c1 = operatorStack.pop();

          // stack.length === 1 for formulae with just one parameter
          if (fnArgType > 0 || stack.length === 1) {
            while (stack.includes(':')) {
              const startIndex = stack.indexOf(':') - 1;

              const [ex, ey] = expr2xy(stack[startIndex + 2]);
              const [sx, sy] = expr2xy(stack[startIndex]);
              fnArgsLen -= 1;

              stack.splice(startIndex, 3);
              let insertAt = startIndex;
              for (let x = sx; x <= ex; x += 1) {
                for (let y = sy; y <= ey; y += 1) {
                  stack.splice(insertAt, 0, xy2expr(x, y));
                  insertAt += 1;
                  fnArgsLen += 1;
                }
              }
            }

            if (fnArgType === 3) {
              stack.push(fnArgOperator);
            }
            stack.push([c1, fnArgsLen]);
            fnArgsLen = 1;
          } else {
            // console.log('c1:', c1, fnArgType, stack, operatorStack);
            while (c1 !== '(') {
              stack.push(c1);
              if (operatorStack.length <= 0) break;
              c1 = operatorStack.pop();
            }
          }
          fnArgType = 0;
        } else if (c === '=' || c === '>' || c === '<') {
          const nc = src.charAt(i + 1);
          fnArgOperator = c;
          if (nc === '=' || nc === '-') {
            fnArgOperator += nc;
            i += 1;
          }
          fnArgType = 3;
        } else if (c === ':') {
          stack.push(':');
          fnArgType = 2;
        } else if (c === ',' || c === ';') {
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
  return { stack, xSheetMap };
};

const evalSubExpr = (subExpr, cellRender, xSheetMapping) => {
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
  let sheet;
  if (xSheetMapping.length) {
    ({ sheet } = xSheetMapping.find(({ cell }) => cell === expr) || {});
  }
  const [x, y] = expr2xy(expr);
  const cellVal = cellRender(x, y, sheet);

  return typeof cellVal === 'number' ? ret * cellVal : cellVal;
};

// evaluate the suffix expression
// srcStack: <= infixExprToSufixExpr
// formulaMap: {'SUM': {}, ...}
// cellRender: (x, y) => {}
const evalSuffixExpr = (srcStack, formulaMap, cellRender, cellList, xSheetMapping) => {
  const stack = [];
  // console.log(':::::formulaMap:', formulaMap);
  for (let i = 0; i < srcStack.length; i += 1) {
    // console.log(':::>>>', srcStack[i]);
    const expr = srcStack[i];
    const [fc] = expr;
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
      let left = stack.pop();
      let ret = false;
      if (Number.isNaN(Number(left)) && Number.isNaN(Number(top))) {
        // use the string length for comparisons
        top = top.length;
        left = left.length;
      } else {
        top = Number(top);
        left = Number(left);
      }
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
    } else if (Array.isArray(expr)) {
      const [formula, len] = expr;
      const params = [];
      const mapping = [];
      for (let j = 0; j < len; j += 1) {
        params.unshift(stack.pop());
        mapping.push(srcStack[j]);
      }
      stack.push(formulaMap[formula].render(params, mapping));
    } else {
      if (cellList.includes(expr)) {
        return 0;
      }
      if ((fc >= 'a' && fc <= 'z') || (fc >= 'A' && fc <= 'Z')) {
        cellList.push(expr);
      }
      stack.push(evalSubExpr(expr, cellRender, xSheetMapping));
      cellList.pop();
    }
    // console.log('stack:', stack);
  }
  return stack[0];
};

const cellRender = (src, formulaMap, getCellText, cellList = []) => {
  if (src[0] === '=') {
    const { stack, xSheetMap } = infixExprToSuffixExpr(src.substring(1));
    if (stack.length <= 0) return src;
    return evalSuffixExpr(
      stack,
      formulaMap,
      (x, y, d) => cellRender(getCellText(x, y, d), formulaMap, getCellText, cellList),
      cellList,
      xSheetMap,
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
