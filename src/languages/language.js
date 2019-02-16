import LANG from './lang.json';

export default class Language {
  constructor(lang) {
    this.lang = lang;
    this.text = LANG[lang];
  }

  get(id) {
    return this.text[id];
  }
}
