/* eslint no-bitwise: "off" */
/*
  v: int value
  digit: bit len of v
  flag: true or false
*/
const bitmap = (v, digit, flag) => {
  const b = 1 << digit;
  return flag ? (v | b) : (v ^ b);
};
export default bitmap;
