const typeMap = {
    "$": /[0-9]+\.?[0-9]+/,
}


export class GDCTValidators {
    constructor(datas) {
        // validators have ri, ci and test function
        this.validators = []
        this.errors = new Map()
        this.datas = datas
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

    validateAll() {
        console.log("hit")
        console.log(this.validators)
        for (let validator of this.validators) {
            
           this.validate(validator);
        }
        return true
    }

    // cellR cell range
    // type either number or attribute

    addValidation(cellR,type,vInfo){
        this.validators.push({cellR,type,vInfo});
        console.log("we made it!!");
        console.log({cellR,type,vInfo});

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

    // v has type, cell range and validation info
    validate(v){
        let {cellR,type,vInfo} = v;
        if(type === 'number'){
            for(let x= cellR.sri; x < cellR.eri+1; x++){
                for(let y= cellR.sci; y < cellR.eci+1; y++){
                   
                    let t = this.datas.getCell(x,y);
                    if(t) {
                        console.log(this.validateNumber(t.text,vInfo));
                        if(!this.validateNumber(t.text,vInfo)){  
                            console.log(" hot the hell " + t.text + " " + vInfo);
                            this.errors.set(`${x}_${y}`, `incorrect type, expected ${vInfo.operator} ${vInfo.value}`)
                        }
                        else{
                            this.errors.clear(`${x}_${y}`);
                        }
                    }
                }
            }
        }

        if(type === 'attribute'){
            for(let x= cellR.sri; x < cellR.eri+1; x++){
                for(let y= cellR.sci; y < cellR.eci+1; y++){
                   
                    let t = this.datas.getCell(x,y);
                    if(t) {
                        if(!this.validateAttribute(t.text,vInfo,x)){ 
                            console.log(" hot the hell " + t.text + " " + vInfo); 
                            this.errors.set(`${x}_${y}`, `incorrect type, expected ${vInfo.operator} ${vInfo.value}`)
                        }
                        else{
                            this.errors.clear(`${x}_${y}`);
                        }
                    }
                }
            }
        }
    }

    // v has operator type, the value, 
    validateNumber(n,v){
        let {operator, value } = v;
        
        let pinput = parseInt(n);
        
        console.log("pinput " + pinput + " pvalue " + value + " ??? " + operator);
        switch(operator){
            case 'gt':
                return pinput > parseInt(value);
            case 'lt':
                return pinput < parseInt(value);
            case 'gte':
                return pinput >= parseInt(value);
            case 'lte':
                return pinput <= parseInt(value);
            case 'eq':
                return pinput == parseInt(value);
            case 'neq':
                return pinput != parseInt(value);
            case 'be':
                return pinput > parseInt(value[0]) && pinput < parseInt(value[1]);
            case 'nbe':
                return pinput < parseInt(value[0]) || pinput > parseInt(value[1]);
        }
    }

    // value is the 
    validateAttribute(n,v,ri){
        let {operator, value } = v;
        let pinput = Number(n);


        if(operator === 'be' || operator === 'nbe'){

            let attrcol = this.datas.findInputColOnRow(9,value[0]);
            let attrcol2 = this.datas.findInputColOnRow(9,value[1]);

            if(attrcol === undefined || attrcol2 === undefined){return true;}
            
            let attrtext = this.datas.getCell(ri,Number(attrcol));
            let attrtext2 = this.datas.getCell(ri,Number(attrcol2));

            if(!attrtext || !attrtext2){ return true;}

            console.log("hitmanchamp");
            console.log(attrtext,attrtext2,pinput);

            switch(operator){
                case 'be':
                    return pinput > parseInt(attrtext.text) && pinput < parseInt(attrtext2.text);
                case 'nbe':
                    return pinput < parseInt(attrtext.text) || pinput > parseInt(attrtext2.text);
            }

        }else{
            let attrcol = this.datas.findInputColOnRow(9,value);
            if(attrcol === undefined){return true}

            let attrtext = this.datas.getCell(ri,Number(attrcol));

            if(!attrtext){ return true;}

            switch(operator){
                case 'gt':
                    return pinput > Number(attrtext.text);
                case 'lt':
                    return pinput < Number(attrtext.text);
                case 'gte':
                    return pinput >= Number(attrtext.text);
                case 'lte':
                    return pinput <= Number(attrtext.text);
                case 'eq':
                    return pinput == Number(attrtext.text);
                case 'neq':
                    return pinput != Number(attrtext.text);
            }
        }

        return true;


    }
}