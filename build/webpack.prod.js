const path = require('path');
const { merge } = require('webpack-merge');
const common = require('./webpack.config.js');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require("terser-webpack-plugin");


module.exports = merge(common, {
  entry: {
    index: './src/index.js',
  },
  mode: 'production',
  devtool: 'source-map',
  plugins: [
    new CleanWebpackPlugin(),
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: '[name].css',
      // chunkFilename: devMode ? '[id].[hash].css' : '[id].css',
    }),
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin()
    ],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, '../dist'),
  },
});
