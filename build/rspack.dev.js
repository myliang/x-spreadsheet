const rspack = require("@rspack/core");
const path = require("path");

module.exports = function (env, argv) {
  return {
    mode: "development",
    devtool: "inline-source-map",

    entry: {
      xspreadsheet: "./src/index.js",
    },
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "../dist"),
    },

    plugins: [
      new rspack.HtmlRspackPlugin({
        template: "./index.html",
        title: "x-spreadsheet",
      }),
    ],

    module: {
      rules: [
        {
          test: /\.css$/i,
          type: "css",
        },
        {
          test: /\.less$/,
          use: [
            {
              loader: "less-loader",
            },
          ],
          type: "css",
        },
        {
          test: /\.(png|svg|jpe?g|gif)$/i,
          type: "asset/resource",
        },
      ],
    },

    devServer: {
      host: "localhost",
      port: 3000,
      static: "../dist",
    },
  };
};
