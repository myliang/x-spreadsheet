export default class Decimal {
    constructor() {

    }

    checkLength(printText, text) {
        return printText.length < text.length;
    }

    moreDecimal(printText, text, cb) {
        const regFloat = /^\d*\.\d+$/g;
        const regInt = /^\d+$/g;

        if (regFloat.test(printText)) {
            if (this.checkLength(printText, text)) {
                cb(printText + text[printText.length]);
            } else {
                cb(printText + '0');
            }
        } else if (regInt.test(printText)) {
            if (this.checkLength(printText, text)) {
                cb(printText + '.' + text[printText.length + 1]);
            } else {
                cb(printText + '.0');
            }
        }
    }

    lessDecimal(printText, text, cb) {
        const regFloat = /^\d*\.\d$/g;
        const regFloat2 = /^\d*\.\d\d+$/g;
        const regInt = /^\d+$/g;

        if (regFloat2.test(printText)) {
            cb(printText.slice(0, -1));
        } else if (regFloat.test(printText)) {
            cb(printText.slice(0, -2));
        } else if (regInt.test(printText)) {
            cb(printText);
        }
    }
}
