/*
raf
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

const match = polymorph();
const matchNull = match.branch(
    function() {
        return this.tagName === 'null';
    },
    function(value) {
        return value === null;
    }
);
['boolean', 'number', 'string', 'symbol', 'undefined'].forEach(function(primitiveName) {
    match.branch(
        function() {
            return this.tagName === primitiveName;
        },
        function(value) {
            return typeof value === primitiveName;
        }
    );
});
const matchConstructedBy = match.branch(
    function() {
        return this.hasOwnProperty('constructedBy');
    },
    function(value) {
        return this.constructedBy.prototype.isPrototypeOf(value);
    }
);
export {
    matchNull,
    matchConstructedBy
};

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
    fill() {},
    pack(product) {
        product.variation('added');
    },

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
        let descriptorProperty;

        if (child === property.valueNode) {
            descriptorProperty = 'value';
        } else if (child === property.getterNode) {
            descriptorProperty = 'get';
        } else if (child === property.setterNode) {
            descriptorProperty = 'set';
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

const touchType = polymorph();
// property
touchType.branch(
    ObjectPropertyElement.asMatcher(),
    function() {
        const touchedProperty = this.make();
        const descriptor = this.descriptor;
        const touchedDescriptor = Object.assign({}, descriptor);
        touchedProperty.descriptor = touchedDescriptor;
        return touchedProperty;
    }
);
// other
touchType.branch(null, function() {
    return this.make();
});
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
    null,
    function() {
        return this.value;
    }
);
const touchChildren = polymorph();
touchChildren.branch(
    ObjectElement.asMatcher(),
    function(elementModel) {
        this.readProperties(this.value);
        // ici il faudrais ptet un truc genre elementModel.exportTouchedChildren(this);
        // faudrais ptet renommer readProperties
        // dailler je vois un souci là, je ne gère pas les conflit entre les éventuelles properties éxistantes
        // de this.value & celle dans elementModel
        // autrement dit le code dans combineChildren est commun à celui-ci de ce point de vue
        // sur elementModel
        for (let child of elementModel) {
            child.touch(this).produce();
        }
    }
);
const TouchTransformation = Transformation.extend({
    debug: !true,

    make(elementModel) {
        return elementModel.touchType();
    },

    fill(element, elementModel) {
        const touchedValue = elementModel.touchValue();
        element.value = touchedValue;
        element.touchChildren(elementModel);
    }
});
const touch = TouchTransformation.asMethod();

const combineType = polymorph();
// Element let the type of the composed prevails
combineType.branch(
    Element.asMatcherStrict(),
    function(element) {
        return element.make();
    }
);
// primitive let the type of the composed prevails
combineType.branch(
    function(element) {
        return this.primitiveMark || element.primitiveMark;
    },
    function(element) {
        return element.make();
    }
);
// property type composition, we have to pass descriptor and a custom compose children
combineType.branch(
    function(otherElement) {
        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            ObjectPropertyElement.isPrototypeOf(otherElement)
        );
    },
    function(otherProperty) {
        const composedProperty = otherProperty.make();
        const secondDescriptor = otherProperty.descriptor;
        const composedDescriptor = Object.assign({}, secondDescriptor);
        composedProperty.descriptor = composedDescriptor;
        return composedProperty;
    }
);
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
// other
combineType.branch(
    null,
    function() {
        return this.make();
    }
);
const combineValue = polymorph();
// Object
combineValue.branch(
    ObjectElement.asMatcherStrict(),
    function() {
        return {};
    }
);
// Array
combineValue.branch(
    ArrayElement.asMatcher(),
    function() {
        return [];
    }
);
// Function
combineValue.branch(
    FunctionElement.asMatcher(),
    function() {
        return cloneFunction(this.value);
    }
);
// Primitives
// Y'a un souci lorsque firstComponent est l'élément pure, voir même dans d'autre cas
// ou le type qu'on choisit n'est pas firstComponent mais secondComponent
// dans ce cas là il faudrais utiliser secondComponent.value hors on utilise firstComponent.value
// dans le code ci-dessous et y'a plusieurs fois ou ça m'a piégé
combineValue.branch(
    function() {
        return this.primitiveMark;
    },
    function(firstComponent, secondComponent) {
        return secondComponent.value;
    }
);
// Boolean, Number, String, Date, RegExp, Error
combineValue.branch(
    ObjectElement.asMatcher(),
    function(firstComponent) {
        return new firstComponent.constructedBy(firstComponent.value.valueOf()); // eslint-disable-line new-cap
    }
);
combineValue.branch(
    ObjectPropertyElement.asMatcher(),
    function(firstProperty, secondProperty) {
        return secondProperty.value;
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
const combineChildren = polymorph();
// object children composition
ObjectPropertyElement.refine({
    readProperties() {
        // devras être renommer readChildren et devra effectivement
        // lire les éventuelles child déjà présent dans this.descriptor
        return [];
    }
});
combineChildren.branch(
    function() {
        return (
            ObjectElement.isPrototypeOf(this) ||
            ObjectPropertyElement.isPrototypeOf(this)
        );
    },
    function(firstComponent, secondComponent) {
        // afin d'obtenir un objet final ayant ses propriétés dans l'ordre le plus logique possible
        // on a besoin de plusieurs étapes pour s'assurer que
        // - les propriétés présentent sur l'objet restent définies avant les autres
        // - les propriétés du premier composant sont définies avant celles du second

        const debug = false;
        function handleEveryCollision(children, otherChildren, markOtherAsHandled) {
            let childIndex = 0;
            let childrenLength = children.length;
            while (childIndex < childrenLength) {
                const child = children[childIndex];
                const otherChild = findConflictualChild(otherChildren, child);
                if (otherChild) {
                    if (markOtherAsHandled) {
                        handleCollision.call(this, child, otherChild);
                        otherChildren.splice(otherChildren.indexOf(otherChild), 1);
                    } else {
                        handleCollision.call(this, otherChild, child);
                    }

                    children.splice(childIndex, 1);
                    childrenLength--;
                } else {
                    childIndex++;
                }
            }
            return childrenLength;
        }

        function findConflictualChild(children, possiblyConflictualChild) {
            return children.find(function(child) {
                return child.conflictsWith(possiblyConflictualChild);
            }, this);
        }

        function handleCollision(child, conflictualChild) {
            if (debug) {
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
            child.combine(conflictualChild, this).produce();
        }

        function handleEveryRemaining(children) {
            for (let child of children) {
                handleRemaining.call(this, child);
            }
        }

        function handleRemaining(child) {
            if (debug) {
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
            child.touch(this).produce();
        }

        const existingChildren = this.readProperties(this.value);
        const firstComponentChildren = firstComponent.children.slice();
        const secondComponentChildren = secondComponent.children.slice();

        // 1 : traite les enfants de firstComponent en conflit avec des enfants existants
        handleEveryCollision.call(this, firstComponentChildren, existingChildren);
        // 2: traite les enfants de secondComponent en conflit avec des enfants existants

        handleEveryCollision.call(this, secondComponentChildren, existingChildren);

        // 3: traite les enfants de firstComponent en conflit avec les enfants de secondComponent
        handleEveryCollision.call(this, firstComponentChildren, secondComponentChildren, true);

        // 4: traite les enfants de secondComponent en conflit avec les enfants de firstComponent
        // normalement cette étape ne sers pas puisque les conflit sont déjà détecté à l'étape 3
        // handleEveryCollision.call(this, secondComponentChildren, firstComponentChildren, true);

        // 5: traite les propriétés de firstComponent sans conflit
        handleEveryRemaining.call(this, firstComponentChildren);

        // 6: traite les propriétés de secondComponent sans conflit
        handleEveryRemaining.call(this, secondComponentChildren);
    }
);
const CombineTransformation = Transformation.extend({
    debug: !true,

    make(firstElement, secondElement) {
        const combined = firstElement.combineType(secondElement);
        if (combined) {
            combined.firstComponent = firstElement;
            combined.secondComponent = secondElement;
        }
        return combined;
    },

    move(combinedElement, firstElement, secondElement, parentElement) {
        // ignore the reactingElement during insertion
        Transformation.move.call(this, combinedElement, firstElement, parentElement);
    },

    fill(combined, firstComponent, secondComponent) {
        const combinedValue = combined.combineValue(firstComponent, secondComponent);
        combined.value = combinedValue;
        combined.combineChildren(firstComponent, secondComponent);
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
    function() {
        const property = this.make();
        property.descriptor = Object.assign({}, this.descriptor);
        return property;
    }
);
instantiateType.branch(null, function() {
    return this.make();
});
const instantiateValue = polymorph();
instantiateValue.branch(
    ObjectElement.asMatcher(),
    function() {
        return Object.create(this.value);
    }
);
const instantiateChildren = polymorph();
instantiateChildren.branch(
    ObjectElement.asMatcher(),
    function(elementModel) {
        this.readProperties(this.value);
        for (let child of elementModel) {
            child.instantiate(this).produce();
        }
    }
);
const InstantiateTransformation = Transformation.extend({
    make(elementModel) {
        return elementModel.instantiateType();
    },

    fill(element, elementModel) {
        const instantiatedValue = elementModel.instantiateValue();
        element.value = instantiatedValue;
        element.instantiateChildren(elementModel);
    }
});
const instantiate = InstantiateTransformation.asMethod();

// length count tracker must be in sync with current amount of indexed properties
[touchValue, combineValue, instantiateValue].forEach(function(method) {
    const ensureCountTrackerSync = method.branch(
        function() {
            return isCountTracker(this);
        },
        function() {
            return this.parentNode.children.reduce(function(previous, current) {
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
touchValue.branch(
    function() {
        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            this.isIndex() &&
            hasLengthPropertyWhichIsCountTracker(this.parentNode)
        );
    },
    function(indexedPropertyModel) {
        let index = indexedPropertyModel.value;
        const length = this.parentNode.getProperty('length').propertyValue;

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

const defaultMalady = {
    match,
    touchType,
    touchValue,
    touchChildren,
    touch,
    combineType,
    combineValue,
    combineChildren,
    conflictsWith,
    combine,
    instantiateType,
    instantiateValue,
    instantiateChildren,
    instantiate,
    construct() {
        return this.instantiate().produce().value;
    }
};

export default defaultMalady;

