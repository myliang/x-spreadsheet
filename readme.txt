mkdir x-spreadsheet && cd x-spreadsheet
npm init -y
npm install webpack webpack-cli --save-dev

mkdir dist src
touch webpack.config.js


npm install --save-dev file-loader css-loader file-loader
npm install --save-dev html-webpack-plugin
npm install --save-dev clean-webpack-plugin
npm install --save-dev webpack-dev-server
npm install --save-dev webpack-merge

npm install eslint --save-dev
./node_modules/.bin/eslint --init # airbnb


# test mocha
npm install --save-dev mocha

# babel
npm install --save-dev babel-loader babel-core babel-preset-env
# for macha
npm install --save-dev babel-register
# npm install --save-dev babel-plugin-transform-runtime
# npm install --save babel-runtime
