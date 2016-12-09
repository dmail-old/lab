/* eslint-disable no-use-before-define */

import {Element} from './lab.js';
import {PrimitiveProperties} from './primitive.js';

// must be registered before ObjectElement because it must match before (during Lab.match)
const PropertyElement = Element.extend('Property', {
    can(what) {
        const lastChar = what[what.length - 1];
        let abilityName;
        if (lastChar === 'a' || lastChar === 'e') {
            abilityName = what.slice(0, -1) + 'able';
        } else {
            abilityName = what + 'able';
        }

        return this.getChildByName(abilityName) !== false;
    },

    getChildByName(name) {
        return this.children.find(function(child) {
            return child.name === name;
        });
    },

    canConfigure() {
        return this.can('configure');
    },

    canEnumer() {
        return this.can('enumer');
    },

    canWrite() {
        return this.can('write');
    },

    isIndex: (function() {
        const STRING = 0; // name is a string it cannot be an array index
        const INFINITE = 1; // name is casted to Infinity, NaN or -Infinity, it cannot be an array index
        const FLOATING = 2; // name is casted to a floating number, it cannot be an array index
        const NEGATIVE = 3; // name is casted to a negative integer, it cannot be an array index
        const TOO_BIG = 4; // name is casted to a integer above Math.pow(2, 32) - 1, it cannot be an array index
        const VALID = 5; // name is a valid array index
        const maxArrayIndexValue = Math.pow(2, 32) - 1;

        function getArrayIndexStatusForString(name) {
            if (isNaN(name)) {
                return STRING;
            }
            const number = Number(name);
            if (isFinite(number) === false) {
                return INFINITE;
            }
            if (Math.floor(number) !== number) {
                return FLOATING;
            }
            if (number < 0) {
                return NEGATIVE;
            }
            if (number > maxArrayIndexValue) {
                return TOO_BIG;
            }
            return VALID;
        }

        function isPropertyNameValidArrayIndex(propertyName) {
            return getArrayIndexStatusForString(propertyName) === VALID;
        }

        return function() {
            return isPropertyNameValidArrayIndex(this.name);
        };
    })(),

    get data() {
        return this.getChildByName('value');
    },

    get getter() {
        return this.getChildByName('getter');
    },

    get setter() {
        return this.getChildByName('setter');
    },

    isData() {
        return Boolean(this.getChildByName('writable'));
    },

    isAccessor() {
        // seul la présent de get ou set garantie qu'on a bien un accessor
        // parce que il existe un moment où propertyElement n'a pas encore
        // d'enfant et donc n'est ni data ni accessor
        // ça pose sûrement souci dailleurs lors de la transformation
        // puisque du coup includeChild va retourner true tant qu'on ne sait pas quel type
        // de propriété on souhait obtenir à la fin
        return Boolean(this.getChildByName('get') || this.getChildByName('set'));
    },

    install(element) {
        const descriptor = this.createDescriptor();
        // console.log('set', this.name, '=', descriptor.value, 'on', element.value);
        Object.defineProperty(element.value, this.name, descriptor);
    },

    createDescriptor() {
        const descriptor = {};
        this.children.forEach(function(child) {
            descriptor[child.name] = child.value;
        });
        return descriptor;
    },

    uninstall(element) {
        delete element.value[this.name];
    }
});

function createConstructedByProperties(Constructor) {
    return {
        valueConstructor: Constructor
    };
}

const ObjectElement = Element.extend('Object', createConstructedByProperties(Object), {
    hasProperty(name) {
        return this.children.some(function(child) {
            return PropertyElement.isPrototypeOf(child) && child.name === name;
        });
    },

    getProperty(name) {
        return this.children.find(function(child) {
            return PropertyElement.isPrototypeOf(child) && child.name === name;
        });
    }
});
const ArrayElement = ObjectElement.extend('Array', createConstructedByProperties(Array));
const BooleanElement = ObjectElement.extend('Boolean', createConstructedByProperties(Boolean));
const NumberElement = ObjectElement.extend('Number', createConstructedByProperties(Number));
const StringElement = ObjectElement.extend('String', createConstructedByProperties(String));
const RegExpElement = ObjectElement.extend('RegExp', createConstructedByProperties(RegExp));
const DateElement = ObjectElement.extend('Date', createConstructedByProperties(Date));
// handle function as primitive because perf
const FunctionElement = ObjectElement.extend('Function',
    createConstructedByProperties(Function),
    PrimitiveProperties
);
// handle error as primitive because hard to preserve stack property
const ErrorElement = ObjectElement.extend('Error',
    createConstructedByProperties(Error),
    PrimitiveProperties
);
// to add : MapElement, MapEntryElement, SetElement, SetEntryElement

export {
    ObjectElement,
    PropertyElement,
    BooleanElement,
    NumberElement,
    StringElement,
    ArrayElement,
    FunctionElement,
    ErrorElement,
    RegExpElement,
    DateElement
};
