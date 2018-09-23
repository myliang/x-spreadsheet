const alphabets = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

export default {
  stringAt: (index) => {
    let str = '';
    let cindex = index;
    while (cindex >= alphabets.length) {
      cindex /= alphabets.length;
      cindex -= 1;
      str += alphabets[parseInt(cindex, 10) % alphabets.length];
    }
    const last = index % alphabets.length;
    str += alphabets[last];
    return str;
  },
  indexAt: (str) => {
    let ret = 0;
    for (let i = 0; i < str.length - 1; i += 1) {
      const cindex = str.charCodeAt(i) - 65;
      const exponet = str.length - 1 - i;
      ret += (alphabets.length ** exponet) + (alphabets.length * cindex);
    }
    ret += str.charCodeAt(str.length - 1) - 65;
    return ret;
  },
};
