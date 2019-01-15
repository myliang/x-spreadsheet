const baseFonts = [
  { key: 'Helvetica', title: 'Helvetica' },
  { key: 'Comic Sans MS', title: 'Comic Sans MS' },
  { key: 'Arial', title: 'Arial' },
  { key: 'Courier New', title: 'Courier New' },
  { key: 'Verdana', title: 'Verdana' },
];

const fontSizes = [
  { pt: 7.5, px: 10 },
  { pt: 9, px: 12 },
  { pt: 10.5, px: 14 },
  { pt: 12, px: 16 },
  { pt: 14, px: 18.7 },
  { pt: 15, px: 20 },
  { pt: 16, px: 21.3 },
  { pt: 18, px: 24 },
  { pt: 22, px: 29.3 },
  { pt: 24, px: 32 },
  { pt: 26, px: 34.7 },
  { pt: 36, px: 48 },
  { pt: 42, px: 56 },
  { pt: 54, px: 71.7 },
  { pt: 63, px: 83.7 },
  { pt: 72, px: 95.6 },
];

const fonts = (ary = []) => {
  const map = {};
  baseFonts.concat(ary).forEach((f) => {
    map[f.key] = f;
  });
  return map;
};

export default {};
export {
  fontSizes,
  fonts,
  baseFonts,
};
