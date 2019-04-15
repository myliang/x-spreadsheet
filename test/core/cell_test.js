import assert from 'assert';
import { describe, it } from 'mocha';
import cell, { infixExprToSuffixExpr } from '../../src/core/cell';
import { formulam } from '../../src/core/formula';

describe('infixExprToSuffixExpr', () => {
  it('should return myname:A1 score:50 when the value is CONCAT("my name:", A1, " score:", 50)', () => {
    assert.equal(infixExprToSuffixExpr('CONCAT("my name:", A1, " score:", 50)').join(''), '"my name:A1" score:50CONCAT,4');
  });
  it('should return A1B2SUM,2C1C5AVERAGE,350B20++ when the value is AVERAGE(SUM(A1,B2), C1, C5) + 50 + B20', () => {
    assert.equal(infixExprToSuffixExpr('AVERAGE(SUM(A1,B2), C1, C5) + 50 + B20').join(''), 'A1B2SUM,2C1C5AVERAGE,350+B20+');
  });
  it('should return A1B2B3SUM,3C1C5AVERAGE,350+B20+ when the value is ((AVERAGE(SUM(A1,B2, B3), C1, C5) + 50) + B20)', () => {
    assert.equal(infixExprToSuffixExpr('((AVERAGE(SUM(A1,B2, B3), C1, C5) + 50) + B20)').join(''), 'A1B2B3SUM,3C1C5AVERAGE,350+B20+');
  });
  it('should return 105-20- when the value is 10-5-20', () => {
    assert.equal(infixExprToSuffixExpr('10-5-20').join(''), '105-20-');
  });
  it('should return 105-2010*- when the value is 10-5-20*10', () => {
    assert.equal(infixExprToSuffixExpr('10-5-20*10').join(''), '105-2010*-');
  });
  it('should return 10520*- when the value is 10-5*20', () => {
    assert.equal(infixExprToSuffixExpr('10-5*20').join(''), '10520*-');
  });
  it('should return 105-20+ when the value is 10-5+20', () => {
    assert.equal(infixExprToSuffixExpr('10-5+20').join(''), '105-20+');
  });
  it('should return 123*+45*6+7*+ when the value is 1 + 2*3 + (4 * 5 + 6) * 7', () => {
    assert.equal(infixExprToSuffixExpr('1+2*3+(4*5+6)*7').join(''), '123*+45*6+7*+');
  });
  it('should return 9312*-3*+42/+ when the value is 9+(3-1*2)*3+4/2', () => {
    assert.equal(infixExprToSuffixExpr('9+(3-1*2)*3+4/2').join(''), '9312*-3*+42/+');
  });
  it('should return 931-+23+*42/+ when the value is (9+(3-1))*(2+3)+4/2', () => {
    assert.equal(infixExprToSuffixExpr('(9+(3-1))*(2+3)+4/2').join(''), '931-+23+*42/+');
  });
  it('should return SUM(1) when the value is 1SUM,1', () => {
    assert.equal(infixExprToSuffixExpr('SUM(1)').join(''), '1SUM');
  });
  it('should return SUM() when the value is ""', () => {
    assert.equal(infixExprToSuffixExpr('SUM()').join(''), 'SUM');
  });
  it('should return SUM( when the value is SUM', () => {
    assert.equal(infixExprToSuffixExpr('SUM(').join(''), 'SUM');
  });
});

describe('cell', () => {
  describe('.render()', () => {
    it('should return 0 + 2 + 2 + 6 + 49 + 20 when the value is =SUM(A1,B2, C1, C5) + 50 + B20', () => {
      assert.equal(cell.render('=SUM(A1,B2, C1, C5) + 50 + B20', formulam, (x, y) => x + y), 0 + 2 + 2 + 6 + 50 + 20);
    });
    it('should return 50 + 20 when the value is =50 + B20', () => {
      assert.equal(cell.render('=50 + B20', formulam, (x, y) => x + y), 50 + 20);
    });
    it('should return 1 + 500 - 20 when the value is =AVERAGE(A1:A3) + 50 * 10 - B20', () => {
      assert.equal(cell.render('=AVERAGE(A1:A3) + 50 * 10 - B20', formulam, (x, y) => {
        console.log('x:', x, ', y:', y);
        return x + y;
      }), 1 + 500 - 20);
    });
  });
});
