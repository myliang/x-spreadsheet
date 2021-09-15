const typeMap = {
    "$": /[0-9]+\.?[0-9]+/,
}

export class GDCTValidators {
    constructor() {
        // validators have ri, ci and test function
        this.validators = []
        this.errors = new Map()
    }

    getError(ri, ci) {
        return this.errors.get(`${ri}_${ci}`)
    }

    //TODO for tomorrow Julien: expose these functions & fix functionality here vvvv then look into making it part of add columns and expand types
    removeRule(ri, ci) {
        for (let i = 0; i < this.validators.length; i++) {
            if (ri === validators[i].ri && ci && this.validators[i].ci) {
                this.validators.splice(i, 1)
            }
        }
        this.errors.clear(`${ri}_${ci}`)
    }

    validateAll(ri, ci, text) {
        for (let validator of this.validators) {
            if (!validator.test(ri, ci, text)) {
                return false
            }
        }
        return true
    }

    addTypeValidator(ri, ci, type) {
        this.validators.push({
            ri,
            ci,
            test: (vri, vci, text) => {
                console.log(`${text}`, typeMap[type].exec(`${text}`))
                const res = typeMap[type].exec(text)
                if (ri === vri && ci === vci && res && res[0] === res.input) {
                    console.log('not ok', res, vci, vri)
                    this.errors.delete(`${ri}_${ci}`)
                } else if (!res || res[0] !== res.input) {
                    console.log('itnots ok', res)
                    this.errors.set(`${ri}_${ci}`, `incorrect type, expected ${type}`)
                }
                return false
            }
        })
    }
}