module.exports = {
  "extends": "airbnb-base",
  "rules": {
    "no-param-reassign": ["error", { "props": false }],
    "class-methods-use-this": "off",
    "no-restricted-syntax": ["error", "WithStatement"],
    "quotes": ["error", "single", { "allowTemplateLiterals": true }],
    "no-console": "off"
  },
};
