const baseFonts = [
  { key: 'Helvetica', title: 'Helvetica' },
  { key: 'Comic Sans MS', title: 'Comic Sans MS' },
  { key: 'Arial', title: 'Arial' },
  { key: 'Courier New', title: 'Courier New' },
  { key: 'Verdana', title: 'Verdana' },
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
  fonts,
  baseFonts,
};
