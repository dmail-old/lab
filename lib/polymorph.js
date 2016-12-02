// dynamicDispatch
// polymorphism

// un polymorh dispatché dynamiquement signifique que
// l'implémentation du polymorph que l'on install sur l'objet est fait dynamiquement
// j'ai donc besoin d'un objet Polymorph avant tout
// comme on peut le voir ci dessus l'implémentation dépend de comment la fonction est appelé

/*
http://raganwald.com/2014/06/23/multiple-dispatch.html
https://en.wikipedia.org/wiki/Multiple_dispatch
Dynamic dispatch : decide which polymorphed function implementation to call dynamically
Single dispatch : the implementation to call depends on the object type the function is bound to
Double/Multiple dispatch: the implementation to call depends on object type & function arguments

Applied to JavaScript it means we'll have a polymorphed function that will decide what will be called
depending on this and arguments
to make it easyly configurable every implementation will be named to be able to change his behaviour later
*/

// pattern
// patternMatching
// select
// selectPattern
// characteristic
// multimethod, multifunction multidispatcj

import util from './util.js';

const Matcher = util.extend({
    constructor(match) {
        this.match = match;
    },

    clone() {
        const clone = this.createConstructor(this.match);
        return clone;
    }
});
const Variant = util.extend({
    constructor(matcher, implementation) {
        this.matcher = matcher;
        this.implementation = implementation;
    },

    match(...args) {
        return this.matcher.match(...args);
    },

    when() {
        const copy = this.createConstructor();
        const length = arguments.length;
        let matcher;
        let implementation;
        if (length === 0) {
            matcher = this.matcher.clone();
            implementation = this.implementation;
        } else if (length === 1) {
            matcher = Matcher.create(arguments[0]);
            implementation = this.implementation;
        } else if (length > 1) {
            matcher = Matcher.create(arguments[0]);
            implementation = arguments[1];
        }
        copy.matcher = matcher;
        copy.implementation = implementation;
    }
});
const variant = Variant.create.bind(Variant);
const Polymorph = util.extend({
    constructor() {
        this.variants = [];
    },

    morph(match, implementation) {
        const variant = Variant.create(Matcher.create(match), implementation);
        this.variants.push(variant);
    },

    vary(...args) {
        return this.morph(...args);
    },

    match(...args) {
        return this.variants.find(function(variant) {
            return variant.match(...args);
        });
    },

    createDynamicMultipleDispatcher() {
        const polymorph = this;
        const dynamicMultipleDispatcher = function() {
            const macthingVariant = polymorph.match(this, arguments);
            return macthingVariant.implementation.apply(this, arguments);
        };
        // It would be convenient to exposed polymorph to be able to add/change/remove variant at runtime

        return dynamicMultipleDispatcher;
    }
});
const polymorph = function(...args) {
    const poly = Polymorph.create();
    poly.variants.push(...args);
    return poly.createDynamicMultipleDispatcher();
};

var ObjectElement;
var Transformation;
var ObjectPropertyElement;
var CancelTransformation;

const delegateObject = variant(
    function() {
        return ObjectElement.isPrototypeOf(this);
    },
    function(parentNode, index) {
        return Transformation.extend({
            fill(element, elementModel) {
                element.value = Object.create(elementModel.value);
                element.importChildren(elementModel);
            }
        }).create(this, parentNode, index);
    }
);
const defineObjectProperty = variant(
    function() {
        if (ObjectPropertyElement.isPrototypeOf(this) === false) {
            return false;
        }
        if (this.descriptor.hasOwnProperty('value')) {
            const valueNode = this.valueNode;
            if (ObjectElement.isPrototypeOf(valueNode)) {
                return true;
            }
        }
        return false;
    },
    function(parentNode, index) {
        return Transformation.extend({
            fill() {

            }
        }).create(this, parentNode, index);
    }
);
const delegateOtherProperty = variant(
    function() {
        return ObjectPropertyElement.isPrototypeOf(this);
    },
    function(parentNode, index) {
        return CancelTransformation.create(this, parentNode, index);
    }
);
const construct = polymorph(
    delegateObject,
    defineObjectProperty,
    delegateOtherProperty
);

export default construct;

// exemple de comment faire en sorte que element.construct se comporte différent
// du comportement par défaut
// const bindMethod = variant(
//     function(elementModel, parentNode) {
//         return parentNode && FunctionElement.isPrototypeOf(this);
//     },
//     function(parentNode, index) {
//         return Transformation.extend({
//             fill(element, elementModel, parentNode) {
//                 element.value = elementModel.value.bind(parentNode.value);
//                 element.importChildren(elementModel);
//             }
//         }).create(this, parentNode, index);
//     }
// );
// const defineObjectAndFunctionProperty = defineobjectProperty.when(
//     // modifier le pattern pour y inclure les fonctions, pas besoin de changer l'implémentation
// );
// const bindMethodConstruct = polymorph(
//     bindMethod,
//     delegateObject,
//     defineObjectAndFunctionProperty,
//     delegateOtherProperty
// );
// element.infect({
//     construct: bindMethodConstruct,
//     transform: null
// });
