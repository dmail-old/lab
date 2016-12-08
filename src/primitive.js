import {
    Element
} from './lab.js';

const PrimitiveProperties = {
    primitiveMark: true
};

const NullPrimitiveElement = Element.extend('null', PrimitiveProperties);
const UndefinedPrimitiveElement = Element.extend('undefined', PrimitiveProperties);
const BooleanPrimitiveElement = Element.extend('boolean', PrimitiveProperties);
const NumberPrimitiveElement = Element.extend('number', PrimitiveProperties);
const StringPrimitiveElement = Element.extend('string', PrimitiveProperties);
const SymbolPrimitiveElement = Element.extend('symbol', PrimitiveProperties);

export {
    PrimitiveProperties,
    NullPrimitiveElement,
    UndefinedPrimitiveElement,
    BooleanPrimitiveElement,
    NumberPrimitiveElement,
    StringPrimitiveElement,
    SymbolPrimitiveElement
};
