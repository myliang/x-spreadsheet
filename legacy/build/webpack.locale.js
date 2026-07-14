const path = require('path');
const fs = require('fs');

const localeFiles = fs.readdirSync(path.resolve(__dirname, '../src/locale'));
const entry = {};
localeFiles.forEach((file) => {
  const name = file.split('.')[0];
  
  if (name !== 'locale') {
    entry[name] = `./src/locale/${file}`;
  }
});

module.exports = {
  entry,
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, '../dist/locale'),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: path.resolve(__dirname, 'locale_loader.js'),
      }
    ]
  },
  plugins: [
  ],
};
