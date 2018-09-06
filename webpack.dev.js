const merge = require('webpack-merge');
const common = require('./webpack.config.js');

module.exports = merge(common, {
  mode: 'development',
  output: {
    filename: '[name].[contenthash].js',
  },
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './dist',
  },
});
