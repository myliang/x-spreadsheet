const rspack = require("@rspack/core");
const path = require("path");
const LicenseCheckerWebpackPlugin = require("license-checker-webpack-plugin");

module.exports = function (env, argv) {
  return {
    mode: "production",
    devtool: "source-map",

    entry: {
      xspreadsheet: "./src/index.js",
    },
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "../dist"),
      // libraryTarget: "commonjs2",
      // https://webpack.js.org/configuration/output/#type-module
      library: { type: "module" },
    },
    experiments: {
      outputModule: true,
    },

    plugins: [
      // copy .d.ts to dist
      new rspack.CopyRspackPlugin({
        patterns: [{ from: "./src/index.d.ts", to: "xspreadsheet.d.ts" }],
      }),

      new rspack.HtmlRspackPlugin({
        template: "./index.html",
        title: "x-spreadsheet",
      }),
      new LicenseCheckerWebpackPlugin({
        outputFilename: "ThirdPartyNotice.txt",
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
  };
};
