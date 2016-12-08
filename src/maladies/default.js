/*
raf

- incrementValue/decrementValue qui devrait recréer un élément
-> attention cela va retrigger ensureCountTrackerSync alors qu'il ne "faudrais" pas, on veut juste incrémenter
on sait déjà combien y'en a

*/

import util from '../util.js';
import {polymorph} from '../polymorph.js';
import {Element} from '../lab.js';
import {
    ObjectElement,
    ObjectPropertyElement,
    ArrayElement,
    FunctionElement
} from '../composite.js';

function isCountTrackerValue(element) {
    // we should ensure value is an integer between 0 and max allowed length
    return element.tagName === 'number';
}
function isCountTracker(element) {
    return (
        ObjectPropertyElement.isPrototypeOf(element) &&
        element.name === 'length' &&
        element.descriptor.hasOwnProperty('value') &&
        isCountTrackerValue(element.valueNode)
    );
}
function hasLengthPropertyWhichIsCountTracker(element) {
    if (ObjectElement.isPrototypeOf(element) === false) {
        return false;
    }
    const lengthProperty = element.getProperty('length');
    return (
        lengthProperty &&
        lengthProperty.descriptor.hasOwnProperty('value') &&
        isCountTrackerValue(lengthProperty.valueNode)
    );
}
function cloneFunction(fn) {
    return function() {
        return fn.apply(this, arguments);
    };
}

Element.refine({
    make() {
        return this.createConstructor.apply(this, arguments);
    },

    asMatcher() {
        const Prototype = this;
        return function() {
            return Prototype.isPrototypeOf(this);
        };
    },

    asMatcherStrict() {
        const Prototype = this;
        return function() {
            return Object.getPrototypeOf(this) === Prototype;
        };
    }
});

const Transformation = util.extend({
    debug: false,

    constructor() {
        this.args = arguments;
    },
    asMethod() {
        const self = this;
        return function(...args) {
            return self.create(this, ...args);
        };
    },

    make() {},
    move(product, element, parentElement) {
        if (parentElement) {
            if (element.parentNode === parentElement) {
                parentElement.replaceChild(element, product);
            } else {
                parentElement.appendChild(product);
            }
        }
    },
    fill(product) {
        const firstElement = arguments[1];
        const secondElement = arguments.length === 3 ? null : arguments[2];

        // afin d'obtenir un objet final ayant ses propriétés dans l'ordre le plus logique possible
        // on a besoin de plusieurs étapes pour s'assurer que
        // - les propriétés présentent sur l'objet restent définies avant les autres
        // - les propriétés du premier composant sont définies avant celles du second
        const existingChildren = product.readChildren();
        const firstElementChildren = firstElement.children.slice();
        const secondElementChildren = secondElement ? secondElement.children.slice() : [];

        // 1 : traite les enfants de firstComponent en conflit avec des enfants existants
        this.handleEveryCollision(product, firstElementChildren, existingChildren);
        // 2: traite les enfants de secondComponent en conflit avec des enfants existants
        this.handleEveryCollision(product, secondElementChildren, existingChildren);
        // 3: traite les enfants de firstComponent en conflit avec les enfants de secondComponent
        this.handleEveryCollision(product, firstElementChildren, secondElementChildren, true);
        // 4: traite les enfants de secondComponent en conflit avec les enfants de firstComponent
        // normalement cette étape ne sers pas puisque les conflit sont déjà détecté à l'étape 3
        // handleEveryCollision.call(this, secondComponentChildren, firstComponentChildren, true);
        // 5: traite les propriétés de firstComponent sans conflit
        this.handleEveryRemaining(product, firstElementChildren);
        // 6: traite les propriétés de secondComponent sans conflit
        this.handleEveryRemaining(product, secondElementChildren);
    },
    pack(product) {
        product.variation('added');
    },

    handleEveryCollision(product, children, otherChildren, markOtherAsHandled) {
        let childIndex = 0;
        let childrenLength = children.length;
        while (childIndex < childrenLength) {
            const child = children[childIndex];
            const otherChild = this.findConflictualChild(otherChildren, child);
            if (otherChild) {
                if (markOtherAsHandled) {
                    this.handleCollision(product, child, otherChild);
                    otherChildren.splice(otherChildren.indexOf(otherChild), 1);
                } else {
                    this.handleCollision(product, otherChild, child);
                }

                children.splice(childIndex, 1);
                childrenLength--;
            } else {
                childIndex++;
            }
        }
        return childrenLength;
    },

    findConflictualChild(children, possiblyConflictualChild) {
        return children.find(function(child) {
            return child.conflictsWith(possiblyConflictualChild);
        }, this);
    },

    handleCollision(product, child, conflictualChild) {
        if (this.debug) {
            if (ObjectPropertyElement.isPrototypeOf(child)) {
                console.log(
                    child.name, 'property collision'
                );
            } else {
                console.log(
                    'value collision between',
                    child.value, 'and', conflictualChild.value,
                    'for property', child.parentNode.name
                );
            }
        }
        this.transformConflictingChild(product, child, conflictualChild);
    },
    transformConflictingChild() {}, // to be implemeted

    handleEveryRemaining(product, children) {
        for (let child of children) {
            this.handleRemaining(product, child);
        }
    },

    handleRemaining(product, child) {
        if (this.debug) {
            if (ObjectPropertyElement.isPrototypeOf(child)) {
                console.log(
                    child.name, 'property has no collision'
                );
            } else {
                console.log(
                    child.value, 'has no collision for property', child.parentNode.name
                );
            }
        }
        this.transformChild(product, child);
    },
    transformChild() {}, // to be implemented

    produce() {
        const args = this.args;
        const product = this.make(...args);
        if (product) {
            this.move(product, ...args);
            this.fill(product, ...args);
            this.pack(product, ...args);
        }
        return product;
    }
});
Element.hooks.removed = function() {
    this.variation('removed');
};

const variation = polymorph();
Element.refine({variation});
// variation.when(
//     function() {
//         return ObjectElement.isPrototypeOf(this);
//     },
//     function() {
//         Object.freeze(this.value);
//     }
// );
// the case above is disabled because freezing the value has an impact so that doing
// instance = Object.create(this.value); instance.property = true; will throw

// when an element is added/removed inside a property
variation.when(
    function() {
        return (
            this.parentNode &&
            ObjectPropertyElement.isPrototypeOf(this.parentNode)
        );
    },
    function(type) {
        const child = this;
        const property = this.parentNode;
        const descriptorModel = property.valueModel.descriptor;
        let descriptorProperty;

        if (descriptorModel.hasOwnProperty('value')) {
            descriptorProperty = 'value';
        } else if (descriptorModel.hasOwnProperty('get') && property.children.length === 0) {
            descriptorProperty = 'get';
        } else if (descriptorModel.hasOwnProperty('set')) {
            descriptorProperty = 'set';
        } else {
            console.error(child, 'is noting inside', property);
        }

        if (type === 'added') {
            // console.log(property.name, 'property descriptor.' + descriptorProperty, '=', child.value);
            property.descriptor[descriptorProperty] = child.value;
        } else if (type === 'removed') {
            delete property.descriptor[descriptorProperty];
        }
    }
);
// when a property is added/removed inside an ObjectElement
variation.when(
    function() {
        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            this.parentNode &&
            ObjectElement.isPrototypeOf(this.parentNode)
        );
    },
    function(type) {
        const property = this;
        const objectElement = this.parentNode;
        if (type === 'added') {
            // console.log('set', property.name, '=', property.descriptor.value, 'on', objectElement.value);
            Object.defineProperty(objectElement.value, property.name, property.descriptor);
        } else if (type === 'removed') {
            delete objectElement.value[property.name];
        }
    }
);
// when an indexed property is added/removed inside an Element having a property count tracker
variation.when(
    function() {
        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            this.isIndex() &&
            this.parentNode &&
            hasLengthPropertyWhichIsCountTracker(this.parentNode)
        );
    },
    function(type) {
        const compositeTrackingItsIndexedProperty = this.parentNode;
        const countTracker = compositeTrackingItsIndexedProperty.getProperty('length');

        if (type === 'added') {
            countTracker.incrementValue();
        } else if (type === 'removed') {
            countTracker.decrementValue();
        }
    }
);

const touchValue = polymorph();
// Object
touchValue.branch(
    ObjectElement.asMatcherStrict(),
    function() {
        return {};
    }
);
// Array
touchValue.branch(
    ArrayElement.asMatcher(),
    function() {
        return [];
    }
);
// Function
touchValue.branch(
    FunctionElement.asMatcher(),
    function() {
        return cloneFunction(this.value);
    }
);
// Boolean, Number, String, RegExp, Date, Error
touchValue.branch(
    ObjectElement.asMatcher(),
    function() {
        return new this.constructedBy(this.value.valueOf()); // eslint-disable-line new-cap
    }
);
// primitives
touchValue.branch(
    function() {
        return this.primitiveMark;
    },
    function() {
        return this.value;
    }
);
// property
touchValue.branch(
    ObjectPropertyElement.asMatcher(),
    function() {
        return this.value;
    }
);

const touchType = polymorph();
// property
touchType.branch(
    ObjectPropertyElement.asMatcher(),
    function(parentNode) {
        const touchedProperty = this.make(this.touchValue(parentNode));
        const descriptor = this.descriptor;
        const touchedDescriptor = {};
        Object.assign(touchedDescriptor, descriptor);
        touchedProperty.descriptor = touchedDescriptor;
        return touchedProperty;
    }
);
// other
touchType.branch(
    null,
    function(parentNode) {
        return this.make(this.touchValue(parentNode));
    }
);

const TouchTransformation = Transformation.extend({
    debug: !true,

    make(elementModel, parentNode) {
        return elementModel.touchType(parentNode);
    },

    transformConflictingChild(product, child, conflictualChild) {
        return child.combine(conflictualChild, product);
    },

    transformChild(product, child) {
        return child.touch(product);
    }
});
const touch = TouchTransformation.asMethod();

const combineValue = polymorph();
const somePrimitive = function(otherElement) {
    return this.primitiveMark || otherElement.primitiveMark;
};
const bothProperty = function(otherElement) {
    return (
        ObjectPropertyElement.isPrototypeOf(this) &&
        ObjectPropertyElement.isPrototypeOf(otherElement)
    );
};
// pure element used otherElement touched value
combineValue.branch(
    Element.asMatcherStrict(),
    function(otherElement, parentNode) {
        return otherElement.touchValue(parentNode);
    }
);
// primitive use otherElement touched value
combineValue.branch(
    somePrimitive,
    function(otherElement, parentNode) {
        return otherElement.touchValue(parentNode);
    }
);
// property use self touched value
combineValue.branch(
    bothProperty,
    function(otherProperty, parentNode) {
        return this.touchValue(parentNode);
    }
);
// for now Object, Array, Function, ... combineValue ignores otherElement value
// and return this touched value, however we can later modify this behaviour
// to say that combinedString must be concatened or combine function must execute one after an other
// Object
combineValue.branch(
    ObjectElement.asMatcherStrict(),
    function(parentNode) {
        return this.touchValue(parentNode);
    }
);
// Array
combineValue.branch(
    ArrayElement.asMatcher(),
    function(parentNode) {
        return this.touchValue(parentNode);
    }
);
// Function
combineValue.branch(
    FunctionElement.asMatcher(),
    function(parentNode) {
        return this.touchValue(parentNode);
    }
);
// Boolean, Number, String, RegExp, Date, Error
combineValue.branch(
    ObjectElement.asMatcher(),
    function(parentNode) {
        return this.touchValue(parentNode);
    }
);

const combineType = polymorph();
// this case exists because array length property is not configurable
// because of that we cannot redefine it when composing array with arraylike
// so when there is a already a length property assume it's in sync
combineType.branch(
    function(otherProperty, parentNode) {
        return (
            isCountTracker(this) &&
            hasLengthPropertyWhichIsCountTracker(parentNode)
        );
    },
    function() {
        return null;
    }
);
// this case happens with array length property
// or function name property, in that case we preserve the current property of the compositeObject
combineType.branch(
    function(otherProperty, parentNode) {
        // console.log('own property is not configurable, cannot make it react');
        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            this.descriptor.configurable === false &&
            this.parentNode === parentNode
        );
    },
    function() {
        return null;
    }
);
// when both element are inside property they may not be combined in some case
combineType.branch(
    function(otherElement) {
        const parentNode = this.parentNode;
        const otherParentNode = otherElement.parentNode;
        const bothInsideProperty = (
            parentNode &&
            ObjectPropertyElement.isPrototypeOf(parentNode) &&
            otherParentNode &&
            ObjectPropertyElement.isPrototypeOf(otherParentNode)
        );
        if (!bothInsideProperty) {
            return false;
        }

        const property = parentNode;
        const otherProperty = otherParentNode;
        // do not combine valueNode when otherProperty is accessor property
        const isValueNode = property.valueNode === this;
        if (isValueNode) {
            return otherProperty.descriptor.hasOwnProperty('value') === false;
        }
        const isGetterNode = property.getterNode === this;
        // do not combine getterNode when otherProperty is value property
        if (isGetterNode) {
            return otherProperty.descriptor.hasOwnProperty('value');
        }
        // do not combine setterNode when otherProperty is value property
        const isSetterNode = property.setterNode === this;
        if (isSetterNode) {
            return otherProperty.descriptor.hasOwnProperty('value');
        }
        return false;
    },
    function() {
        return null;
    }
);
// otherElement type prevails for Element and primitives
combineType.branch(
    function() {
        return (
            Element.asMatcherStrict().apply(this, arguments) ||
            somePrimitive.apply(this, arguments)
        );
    },
    function(otherElement, parentNode) {
        return otherElement.make(this.combineValue(otherElement, parentNode));
    }
);
// property type composition, we have to pass descriptor
combineType.branch(
    function(otherElement) {
        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            ObjectPropertyElement.isPrototypeOf(otherElement)
        );
    },
    function(otherProperty, parentNode) {
        const composedProperty = this.make(this.combineValue(otherProperty, parentNode));
        const secondDescriptor = otherProperty.descriptor;
        const composedDescriptor = Object.assign({}, secondDescriptor);
        composedProperty.descriptor = composedDescriptor;
        return composedProperty;
    }
);
// objects let first type prevails
combineType.branch(
    ObjectElement.asMatcher(),
    function(otherElement, parentNode) {
        return this.make(this.combineValue(otherElement, parentNode));
    }
);

const conflictsWith = polymorph();
// property children conflict is special
conflictsWith.branch(
    function(otherChild) {
        return (
            ObjectPropertyElement.isPrototypeOf(this.parentNode) &&
            ObjectPropertyElement.isPrototypeOf(otherChild.parentNode)
        );
    },
    function(otherChild) {
        const property = this.parentNode;
        const otherProperty = otherChild.parentNode;

        if (this === property.valueNode) {
            return otherProperty.valueNode === otherChild;
        }
        if (this === property.getterNode) {
            return otherProperty.getterNode === otherChild;
        }
        if (this === property.setterNode) {
            return otherProperty.setterNode === otherChild;
        }
    }
);
// property conflict (use name)
conflictsWith.branch(
    function(otherElement) {
        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            ObjectPropertyElement.isPrototypeOf(otherElement)
        );
    },
    function(otherProperty) {
        return this.name === otherProperty.name;
    }
);
conflictsWith.branch(null, function() {
    return false;
});
const CombineTransformation = Transformation.extend({
    debug: !true,

    make(firstElement, secondElement, parentNode) {
        const combined = firstElement.combineType(secondElement, parentNode);
        if (combined) {
            combined.firstComponent = firstElement;
            combined.secondComponent = secondElement;
        }
        return combined;
    },

    move(product, firstElement, secondElement, parentElement) {
        Transformation.move.call(this, product, firstElement, parentElement);
    },

    transformConflictingChild(product, child, conflictualChild) {
        return child.combine(conflictualChild, product);
    },

    transformChild(product, child) {
        return child.touch(product);
    }
});
const combine = CombineTransformation.asMethod();

const instantiateType = polymorph();
instantiateType.branch(
    Element.asMatcherStrict(),
    function() {
        throw new Error('pure element cannot be instantiated');
    }
);
// delegate property which hold primitives
instantiateType.branch(
    function() {
        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            this.descriptor.hasOwnProperty('value') &&
            this.valueNode.primitiveMark
        );
    },
    function() {
        return null;
    }
);
instantiateType.branch(
    ObjectPropertyElement.asMatcher(),
    function(parentNode) {
        const property = this.make(this.instantiateValue(parentNode));
        property.descriptor = Object.assign({}, this.descriptor);
        return property;
    }
);
instantiateType.branch(null, function(parentNode) {
    return this.make(this.instantiateValue(parentNode));
});
// il manque quand même le pouvoir ici-même de dire ok pour l'instantiation j'aimerais ce comportement spécifique
const instantiateValue = polymorph();
instantiateValue.branch(
    ObjectElement.asMatcher(),
    function() {
        return Object.create(this.value);
    }
);
const InstantiateTransformation = Transformation.extend({
    make(elementModel, parentNode) {
        return elementModel.instantiateType(parentNode);
    },

    transformConflictingChild(product, child, conflictualChild) {
        return child.combine(conflictualChild, product);
    },

    transformChild(product, child) {
        return child.instantiate(product);
    }
});
const instantiate = InstantiateTransformation.asMethod();

// length count tracker must be in sync with current amount of indexed properties
// doit se produire pour touch, combine et instantiate, là c'est pas le cas
[touchValue, combineValue, instantiateValue].forEach(function(method) {
    const ensureCountTrackerSync = method.branch(
        function() {
            return isCountTracker(this);
        },
        function() {
            // for touchValue & instantiateValue parentNode is the first argument
            // but for combineValue its the second
            const parentNode = arguments[arguments.length === 1 ? 0 : 1];

            return parentNode.children.reduce(function(previous, current) {
                if (ObjectPropertyElement.isPrototypeOf(current) && current.isIndex()) {
                    previous++;
                }
                return previous;
            }, 0);
        }
    );
    method.prefer(ensureCountTrackerSync);
});

/*
Explication sur le cas spécial de la propriété length
Chacun des deux éléments composé peut être un array, arraylike ou composite
array:  lorsque la propriété length appartient à un objet Array
arraylike : lorsqu'un object a une propriété length qui est une valeur numérique
compositeValue : un objet sans propriété length ou alors celle-ci est un accesseur n'a pas une valeur numérique valide

Et voici ce qu'on fait pour chaque cas
array compose array|arraylike|compositeValue
    -> la propriété length existe déjà sur composite.value, elle est ignoré (CancelReaction)
arraylike compose array|arraylike|composite
    -> la propriété length n'existe pas encore sur composite.value, elle est reset
    à sa valeur initiale (le nombre actuel de propriété indexé sur composite.value, en général ce sera 0)
compositeValue compose array|arraylike
    -> compositeValue récupèrera la propriété length de array ou arraylike, en faisant ainsi un arraylike
    la valeur de la propriété length est alors mise à jour pour tenir compte des propriétés indexés du composite
compositeValue compose compositeValue
    -> si elle existe la propriété length est passé sans logique particulière
*/

// array concatenation
const debugArrayConcat = true;
const ignoreConcatenedPropertyConflict = conflictsWith.branch(
    function() {
        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            this.isIndex() &&
            hasLengthPropertyWhichIsCountTracker(this.parentNode)
        );
    },
    function(otherProperty) {
        if (debugArrayConcat) {
            console.log(
                'ignoring conflict for',
                otherProperty.descriptor.value,
                'because it will be concatened'
            );
        }
        return false;
    }
);
conflictsWith.prefer(ignoreConcatenedPropertyConflict);
const concatIndexedProperty = touchValue.branch(
    function(parentNode) {
        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            this.isIndex() &&
            hasLengthPropertyWhichIsCountTracker(parentNode)
        );
    },
    function(parentNode) {
        let index = this.value;
        const length = parentNode.getProperty('length').propertyValue;

        if (length > 0) {
            const currentIndex = Number(index);
            const concatenedIndex = currentIndex + length;
            index = String(concatenedIndex);
            if (debugArrayConcat) {
                console.log('index updated from', currentIndex, 'to', concatenedIndex);
            }
        }

        return index;
    }
);
touchValue.prefer(concatIndexedProperty);

const defaultMalady = {
    touchType,
    touchValue,
    touch,
    combineType,
    combineValue,
    conflictsWith,
    combine,
    instantiateType,
    instantiateValue,
    instantiate,
    construct() {
        return this.instantiate().produce().value;
    }
};

export default defaultMalady;

