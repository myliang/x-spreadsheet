function getLocaleCode(name, code) {
  return `${code.replace('export default', 'const message =')}
if (window && window.x_spreadsheet) {
  window.x_spreadsheet.$messages = window.x_spreadsheet.$messages || {};
  window.x_spreadsheet.$messages['${name}'] = message;
}
export default message;
`;
}

module.exports = function (content, map, meta) {
  // this.callback(null, someSyncOperation(content), map, meta);
  // console.log(this.resourcePath)
  // console.log(this.currentLoader)
  // console.log(this.mode)
  const fileName = this.resourcePath.slice(this.resourcePath.lastIndexOf("/")+1);
  const [lang] = fileName.split(".");

  this.callback(null, getLocaleCode(lang, content), map, meta);
  return;
};