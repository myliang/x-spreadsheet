import assert from 'assert';
import { describe, it } from 'mocha';
import { expr2xy } from '../../src/core/alphabet';
import cell from '../../src/core/cell';
import Table from '../../src/component/table';

// ----------------------------------------------------------------------------
// MOCKS
// ----------------------------------------------------------------------------

// The cell module's render function uses the hot-formula-parser library's
// Parser.parse method. Parser.parse relies on its callCellValue and
// callRangeValue event handlers being defined by the calling application to
// provide the values contains by cells referenced in the formula being parsed.
// The Table object instantiates the Parser.parse object in the application and
// defines the callCellValue and callRangeValue event handlers. Therefore,
// calling the cell module's render function also requires instantiating a
// Table object so that said event handlers are defined. And instantiating a
// Table object requires mocking some of its dependencies.

// Mock storage for the values in each cell in the table
let __cellData = {};

// Example: setCellData('A3', 3) stores the value 3 in __cellData[2][0]
function setCellData(expr, value) {
  const [x, y] = expr2xy(expr);
  __cellData[y] = __cellData[y] || {};
  __cellData[y][x] = value.toString();
}

// Add window global if it doesn't exist
if (typeof window === 'undefined') {
  global.window = {};
}
window.devicePixelRatio = 0;

const mockEl = {
  getContext: (_) => {
    return {
      scale: (x, y) => {}
    };
  },
  width: 0,
  height: 0,
  style: {
    width: 0,
    height: 0
  }
};

const mockData = {
  viewWidth: () => 0,
  viewHeight: () => 0,
  getCellTextOrDefault: (rowIndex, colIndex) => {
    if (__cellData[rowIndex] && __cellData[rowIndex][colIndex])
      return __cellData[rowIndex][colIndex];

    return null;
  }
}

// ----------------------------------------------------------------------------
// TEST CASES
// ----------------------------------------------------------------------------

// The table objects sets up the following dependencies of cell.render:
// - the hot-formula-parser module's Parser object needed as an argument
// - the above Parser object's callCellValue and callRangeValue event handlers
const table = new Table(mockEl, mockData);

describe('cell', () => {
  describe('.render()', () => {
    it('should return 2 when the value is IF(AND(1=1, 2>1), 2, 1)', () => {
      assert.equal(cell.render('=IF(AND(1=1, 2>1), 2, 1)', table.formulaParser), 2);
    });
    it('should return 57 when the value is =(9+(3-1))*(2+3)+4/2', () => {
      assert.equal(cell.render('=(9+(3-1))*(2+3)+4/2', table.formulaParser), 57);
    });
    it('should return 0 + 2 + 2 + 6 + 49 + 20 when the value is =SUM(A1,B2, C1, C5) + 50 + B20', () => {
      setCellData('A1', 0);
      setCellData('B2', 2);
      setCellData('C1', 2);
      setCellData('C5', 6);
      setCellData('B20', 20);

      assert.equal(cell.render('=SUM(A1,B2, C1, C5) + 50 + B20', table.formulaParser), 0 + 2 + 2 + 6 + 50 + 20);
    });
    it('should return 50 + 20 when the value is =50 + B20', () => {
      setCellData('B20', 20);

      assert.equal(cell.render('=50 + B20', table.formulaParser), 50 + 20);
    });
    it('should return 2 when the value is =IF(2>1, 2, 1)', () => {
      assert.equal(cell.render('=IF(2>1, 2, 1)', table.formulaParser), 2);
    });
    it('should return 1 + 500 - 20 when the value is =AVERAGE(A1:A3) + 50 * 10 - B20', () => {
      setCellData('A1', -1);
      setCellData('A2', 1);
      setCellData('A3', 3);
      setCellData('B20', 20);

      assert.equal(cell.render('=AVERAGE(A1:A3) + 50 * 10 - B20', table.formulaParser), 1 + 500 - 20);
    });
  });
});
