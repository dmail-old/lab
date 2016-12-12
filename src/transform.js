/*
raf

- avoir la possibilité de modifier les valeurs via une API du genre element.replace(value)
on utilisera cette api par example pour modifier la velur d'une propriété
on pourra ainsi faire object.getProperty('name').replace('seb');
peut être appeler ça "mutate" et pas "replace"
et bim on peut modifier la valeur 'name' par 'seb' mais cette opération ne recréé pas toute la structure
- incrementValue/decrementValue qui devrait recréer un élément en utilisant l'api décrite ci-dessus
attention cela va retrigger ensureCountTrackerSync alors qu'il ne "faudrais" pas, on veut juste incrémenter
on sait déjà combien y'en a, donc un moyen peut être de modifier cette valeur en désactivant ce listener spécifique
quoiqu'en fait lorsqu'on passe par cette api de mutation ou alors par scan on ne trigger pas ensureCountTrackerSync
puisque celui-ci est trigger par touchValue, composeValue et instantiateValue

- on va pouvoir réactiver le fait de freeze les objets puisqu'en fait on va freeze
mais on a un objet interne qui n'est pas freeze et qu'on peut donc instancier ;)
attention il ne faudrais freeze que pour scan, dans les autres cas on ne freeze pas puisque l'objet
attention aussi je propose une api pemettant de mutate ce qui est incohérent avec le fait que l'objet soit freeze
on peut considérer freeze comme un moyen de se protéger et que seul la méthode mutate ou alors faire
element.value.foo = true, permettent de modifier l'objet
en tous les ca sil est trop tôt pour freeze l'object lors du scan c'est de la finition

// pour le moment on set le nom sur propertyCHild
// c'est pas optimal parce que l'enfant n'a pas à savoir
// cela et ca rend un peu confus avec les propriété qui on aussi une propriété name
// idéalement les enfant d'une propriété devrait être stocké dans
// une map genre {writable: writableNode} et manipulé comme une liste là ou c'est nécéssaire
// en fait même les children de object devrait être une map...
// une propriété qui connait son nom c'est un peu comme un élément dans un tableau qui connaitrais son index
// autrement dit chiant à maintenir et ça mélange donnée et structuration des données
// idéalement il faudrais donc "supprimer" le fait que children soit un tableau
*/

import util from './util.js';
import {polymorph} from './polymorph.js';
import {Lab, Element} from './lab.js';
import {
    NullPrimitiveElement,
    UndefinedPrimitiveElement,
    BooleanPrimitiveElement,
    NumberPrimitiveElement,
    StringPrimitiveElement,
    SymbolPrimitiveElement
} from './primitive.js';
import {
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
} from './composite.js';

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
const PropertyDefinition = util.extend({
    constructor(name, descriptor) {
        this.name = name;
        if (descriptor) {
            this.descriptor = descriptor;
        }
    },
    descriptor: {}
});
function cloneFunction(fn) {
    // a true clone must handle new  https://gist.github.com/dmail/6e639ac50cec8074a346c9e10e76fa65
    return function() {
        return fn.apply(this, arguments);
    };
}
// const DataPropertyElement = PropertyElement.extend('DataPropertyElement', {
//     includeChild() {
//         return (
//             child.descriptorName === 'configurable' ||
//             child.descriptorName === 'enumerable' ||
//             child.descriptorName === 'writable' ||
//             child.descriptorName === 'value'
//         );
//     }
// });
// const AccessorPropertyElement = PropertyElement.extend('DataPropertyElement', {
//     includeChild() {
//         return (
//             child.descriptorName === 'configurable' ||
//             child.descriptorName === 'enumerable' ||
//             child.descriptorName === 'get' ||
//             child.descriptorName === 'set'
//         );
//     }
// });

// match
(function() {
    Element.refine({
        match() {
            return false;
        }
    });

    // null primitive is special
    NullPrimitiveElement.refine({
        match(value) {
            return value === null;
        }
    });
    // property are special
    PropertyElement.refine({
        match(value) {
            return PropertyDefinition.isPrototypeOf(value);
        }
    });

    function valueTypeMatchTagName(value) {
        return typeof value === this.tagName;
    }
    [
        UndefinedPrimitiveElement,
        BooleanPrimitiveElement,
        NumberPrimitiveElement,
        StringPrimitiveElement,
        SymbolPrimitiveElement
    ].forEach(function(Element) {
        Element.refine({
            match: valueTypeMatchTagName
        });
    });
    function valueMatchConstructorPrototype(value) {
        return this.valueConstructor.prototype.isPrototypeOf(value);
    }
    [
        ObjectElement,
        BooleanElement,
        NumberElement,
        StringElement,
        ArrayElement,
        FunctionElement,
        ErrorElement,
        RegExpElement,
        DateElement
    ].forEach(function(Element) {
        Element.refine({
            match: valueMatchConstructorPrototype
        });
    });
})();

// include child
(function() {
    Element.refine({
        includeChild() {
            return this.primitiveMark !== true;
        }
    });
    PropertyElement.refine({
        includeChild(child) {
            if (this.isData()) {
                // data property ignores getter & setter
                return (
                    child.name === 'configurable' ||
                    child.name === 'enumerable' ||
                    child.name === 'writable' ||
                    child.name === 'value'
                );
            }
            if (this.isAccessor()) {
                // accessor property ignores writable & values
                return (
                    child.name === 'configurable' ||
                    child.name === 'enumerable' ||
                    child.name === 'get' ||
                    child.name === 'set'
                );
            }
            return true;
        }
    });
    // disable function.prototype property disocverability to prevent infinite recursion
    // it's because prototype is a cyclic structure due to circular reference between prototype/constructor
    // we could delay the function.prototype.constructor discoverability to be more accurate
    // includeChild would be different then, it would occur on ObjectElement when
    // the child is named constructor and that parent is a function
    FunctionElement.refine({
        includeChild(child) {
            return child.name !== 'prototype';
        }
    });
})();

const combineChildren = (function() {
    const debug = true;

    function combineChildrenOneSource(sourceElement, destinationElement) {
        const filteredSourceElementChildren = filterChildren(sourceElement, destinationElement);
        const unConflictualSourceElementChildren = collideChildren(filteredSourceElementChildren, destinationElement);

        return unConflictualSourceElementChildren;
    }

    function combineChildrenTwoSource(firstSourceElement, secondSourceElement, destinationElement) {
        // afin d'obtenir un objet final ayant ses propriétés dans l'ordre le plus logique possible
        // on a besoin de plusieurs étapes pour s'assurer que
        // - les propriétés présentent sur l'objet restent définies avant les autres
        // - les propriétés du premier composant sont définies avant celles du second

        // 1: garde uniquement les enfants que destinationElement accepte
        const filteredFirstSourceChildren = filterChildren(
            firstSourceElement,
            destinationElement
        );
        const filteredSecondSourceChildren = filterChildren(
            secondSourceElement,
            destinationElement
        );
        // 2 : met les enfants dont le conflit concerne  first ou second avec existing et récupère ce qui reste
        const remainingFirstSourceChildren = collideChildren(
            filteredFirstSourceChildren,
            destinationElement
        );
        const remainingSecondSourceChildren = collideChildren(
            filteredSecondSourceChildren,
            destinationElement
        );
        // 3 : met les enfants pour lesquelles il y a un conflit entre first & second et récupère ce qui reste
        const remainingChildren = collideRemainingChildren(
            remainingFirstSourceChildren,
            remainingSecondSourceChildren,
            destinationElement
        );
        // 4 : retourne ce qui reste
        return remainingChildren;
    }

    function filterChildren(sourceElement, destinationElement) {
        return sourceElement.children.filter(function(sourceElementChild) {
            if (destinationElement.includeChild(sourceElementChild) === false) {
                if (debug) {
                    console.log(sourceElementChild.path, 'cannot be included at', destinationElement.path);
                }
                return false;
            }
            return true;
        });
    }

    function collideChildren(children, destinationElement) {
        return children.filter(function(child) {
            const destinationChild = findConflictualChild(child, destinationElement.children);
            if (destinationChild) {
                collideChild(child, destinationChild, destinationElement);
                return false;
            }
            return true;
        });
    }

    function findConflictualChild(child, children) {
        return children.find(function(destinationChild) {
            return child.conflictsWith(destinationChild);
        }, this);
    }

    function collideChild(child, otherChild, destinationElement) {
        if (debug) {
            if (PropertyElement.isPrototypeOf(otherChild)) {
                console.log(
                    'collision for', otherChild.path
                );
            } else {
                console.log(
                    'collision for', otherChild.path, 'between', otherChild.value, 'and', child.value
                );
            }
        }

        otherChild.combine(child, destinationElement).produce();
    }

    function collideRemainingChildren(remainingFirstChildren, remainingSecondChildren, destinationElement) {
        const remainingChildren = [];
        const conflictualSecondChildren = [];

        for (let remainingFirstChild of remainingFirstChildren) {
            const remainingSecondChild = findConflictualChild(remainingFirstChild, remainingSecondChildren);
            if (remainingSecondChild) {
                collideChild(remainingFirstChild, remainingSecondChild, destinationElement);
                conflictualSecondChildren.push(remainingSecondChild);
            } else {
                remainingChildren.push(remainingFirstChild);
            }
        }
        for (let remainingSecondChild of remainingSecondChildren) {
            if (conflictualSecondChildren.indexOf(remainingSecondChild) === -1) {
                remainingChildren.push(remainingSecondChild);
            }
        }

        return remainingChildren;
    }

    return function combineChildren() {
        if (arguments.length === 2) {
            return combineChildrenOneSource.apply(this, arguments);
        }
        if (arguments.length === 3) {
            return combineChildrenTwoSource.apply(this, arguments);
        }
        throw new Error('combineChildren expect exactly 2 or 3 arguments');
    };
})();

const CancelTransformation = {};
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
    transform() {},
    filter(product) {
        if (!product) {
            return false;
        }
        const parentNode = this.args[this.parentNodeIndex];
        if (!parentNode) {
            return true;
        }
        return parentNode.includeChild(product);
    },
    move(product) {
        const parentNode = this.args[this.parentNodeIndex];
        if (parentNode) {
            const existing = this.args[0];
            if (Element.isPrototypeOf(existing) && existing.parentNode === parentNode) {
                parentNode.replaceChild(existing, product);
            } else {
                parentNode.appendChild(product);
            }
        }
    },
    fill() {

    },
    pack(product) {
        product.variation('added');
    },

    createProduct() {
        let product;

        try {
            const args = this.args;
            const value = this.make(...args);
            product = this.transform(value, ...args);
            if (this.filter(product, ...args) === false) {
                product = undefined;
            }
        } catch (e) {
            if (e === CancelTransformation) {
                product = undefined;
            } else {
                throw e;
            }
        }

        return product;
    },

    produce() {
        const product = this.createProduct();
        if (product) {
            const args = this.args;
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

const scanValue = polymorph();
const ScanTransformation = Transformation.extend({
    parentNodeIndex: 2,

    make(value) {
        return Lab.findElementByValueMatch(value).create();
    },

    transform(product, value, name) {
        product.name = name;
        product.valueModel = value; // we need to remind valueModel if we want cyclic structure support
        product.value = product.scanValue(value);
        return product;
    },

    fill(product, value) {
        // il n'y a pas de conflit ni de propriété existante pour un scan
        if (ObjectElement.isPrototypeOf(product)) {
            Object.getOwnPropertyNames(value).forEach(function(name) {
                const descriptor = Object.getOwnPropertyDescriptor(value, name);
                const definition = PropertyDefinition.create(name, descriptor);
                this.createConstructor(definition, name, product).produce();
            }, this);
        } else if (PropertyElement.isPrototypeOf(product)) {
            const descriptor = value.descriptor;
            Object.keys(descriptor).forEach(function(key) {
                this.createConstructor(descriptor[key], key, product).produce();
            }, this);
        }
    }
});
const scan = function(...args) {
    return ScanTransformation.create(...args).produce();
};
const scanProduct = function(value, name) {
    const element = ScanTransformation.make(value);
    ScanTransformation.transform(element, value, name);
    return element;
};

scanValue.branch(
    function() {
        return this.primitiveMark;
    },
    function(value) {
        return value;
    }
);
scanValue.branch(
    ObjectElement.asMatcherStrict(),
    function() {
        return {};
    }
);
scanValue.branch(
    ArrayElement.asMatcher(),
    function() {
        return [];
    }
);
scanValue.branch(
    ObjectElement.asMatcher(),
    function(value) {
        return new value.constructor(value.valueOf()); // eslint-disable-line new-cap
    }
);
scanValue.branch(
    PropertyElement.asMatcher(),
    function() {

    }
);

const variation = polymorph();
const conflictsWith = polymorph();

const touchValue = polymorph();
const TouchTransformation = Transformation.extend({
    parentNodeIndex: 1,

    make(elementModel, parentNode) {
        return elementModel.touchValue(parentNode);
    },

    transform(touchedValue, elementModel) {
        const product = scanProduct(touchedValue, elementModel.name);
        return product;
    },

    fill(product, elementModel, parentNode) {
        ScanTransformation.fill.call(this, product, product.valueModel, elementModel.name, parentNode);
        const remainingChildren = combineChildren(elementModel, product);
        for (let child of remainingChildren) {
            child.touch(product).produce();
        }
    }
});
const touch = TouchTransformation.asMethod();
const combineValue = polymorph();
const CombineTransformation = Transformation.extend({
    parentNodeIndex: 2,

    make(firstElement, secondElement, parentNode) {
        return firstElement.combineValue(secondElement, parentNode);
    },

    transform(combinedValue, firstElement, secondElement) {
        // comment je sais le nom du produit ??????
        // soit c'est forcément celui de firstElement parce qu'il ont le même
        // soit dans le cas des propriétés il faut choisir
        // et ce choix est fait par combineValue mais je n'ai pas la main dessus
        // je rapelle qu'idéalement une valeur ne DOIT pas savoir de qu'elle propriété elle provient
        // les objet propriétés ne sont donc pas des éléments comme les autres
        // ils forments le lien entre deux valeurs mais ne sont pas des valeur
        let product;
        if (PropertyDefinition.isPrototypeOf(combinedValue)) {
            product = scanProduct(combinedValue, combinedValue.name);
        } else {
            product = scanProduct(combinedValue, firstElement.name);
        }

        product.firstComponent = firstElement;
        product.secondComponent = secondElement;
        return product;
    },

    fill(product, firstElement, secondElement) {
        ScanTransformation.fill.call(this, product, product.valueModel);

        const remainingChildren = combineChildren(firstElement, secondElement, product);
        for (let child of remainingChildren) {
            child.touch(product).produce();
        }
    }
});
const combine = CombineTransformation.asMethod();
const instantiateValue = polymorph();
const InstantiateTransformation = Transformation.extend({
    parentNodeIndex: 1,

    make(elementModel, parentNode) {
        return elementModel.instantiateValue(parentNode);
    },

    transform(instantiedValue) {
        return scan(instantiedValue);
    },

    fill(product, elementModel) {
        const remainingChildren = combineChildren(elementModel, product);
        for (let child of remainingChildren) {
            child.instantiate(product).produce();
        }
    }
});
const instantiate = InstantiateTransformation.asMethod();

/* ---------------- core ---------------- */
// when a property is added/removed inside an ObjectElement
variation.when(
    function() {
        return (
            PropertyElement.isPrototypeOf(this) &&
            this.parentNode &&
            ObjectElement.isPrototypeOf(this.parentNode)
        );
    },
    function(type) {
        const property = this;
        const objectElement = this.parentNode;
        if (type === 'added') {
            property.install(objectElement);
        } else if (type === 'removed') {
            property.uninstall(objectElement);
        }
    }
);

// property children conflict is special, only child of the same descriptorName are in conflict
conflictsWith.branch(
    function(otherChild) {
        return (
            PropertyElement.isPrototypeOf(this.parentNode) &&
            PropertyElement.isPrototypeOf(otherChild.parentNode)
        );
    },
    function(otherChild) {
        return this.name === otherChild.name;
    }
);
// property conflict (use name)
conflictsWith.branch(
    function(otherElement) {
        return (
            PropertyElement.isPrototypeOf(this) &&
            PropertyElement.isPrototypeOf(otherElement)
        );
    },
    function(otherProperty) {
        return this.name === otherProperty.name;
    }
);
conflictsWith.branch(null, function() {
    return false;
});

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
        return new this.valueConstructor(this.value.valueOf()); // eslint-disable-line new-cap
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
    PropertyElement.asMatcher(),
    function() {
        return PropertyDefinition.create(this.name);
    }
);
// this case happens with array length property
// or function name property, in that case we preserve the current property of the compositeObject
combineValue.branch(
    function(otherElement, parentNode) {
        // console.log('own property is not configurable, cannot make it react');
        return (
            PropertyElement.isPrototypeOf(this) &&
            this.parentNode === parentNode &&
            this.canConfigure() === false
        );
    },
    function() {
        throw CancelTransformation;
    }
);
// pure element used otherElement touched value
combineValue.branch(
    Element.asMatcherStrict(),
    function(otherElement, parentNode) {
        return otherElement.touchValue(parentNode);
    }
);
// primitive use otherElement touched value
combineValue.branch(
    function(otherElement) {
        return (
            this.primitiveMark ||
            otherElement.primitiveMark
        );
    },
    function(otherElement, parentNode) {
        return otherElement.touchValue(parentNode);
    }
);
// property use otherProperty touched value (inherits name)
combineValue.branch(
    function(otherElement) {
        return (
            PropertyElement.isPrototypeOf(this) &&
            PropertyElement.isPrototypeOf(otherElement)
        );
    },
    function(otherProperty, parentNode) {
        return otherProperty.touchValue(parentNode);
    }
);
// for now combinedValue on Object, Array, Function, etc ignores otherElement value
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

instantiateValue.branch(
    Element.asMatcherStrict(),
    function() {
        throw new Error('pure element cannot be instantiated');
    }
);
instantiateValue.branch(
    ObjectElement.asMatcher(),
    function() {
        return Object.create(this.value);
    }
);
// delegate property which hold primitives
instantiateValue.branch(
    function() {
        return (
            PropertyElement.isPrototypeOf(this) &&
            this.isData() &&
            this.data.primitiveMark
        );
    },
    function() {
        throw CancelTransformation;
    }
);
instantiateValue.branch(
    PropertyElement.asMatcher(),
    function(parentNode) {
        return this.touchValue(parentNode);
    }
);

/* ---------------- Freezing value ---------------- */
// disabled because freezing the value has an impact so that doing
// instance = Object.create(this.value); instance.property = true; will throw
// variation.when(
//     function() {
//         return ObjectElement.isPrototypeOf(this);
//     },
//     function() {
//         Object.freeze(this.value);
//     }
// );

/* ---------------- countTracker ---------------- */
(function() {
    const countTrackerPropertyName = 'length';

    function isCountTrackerValue(element) {
        // we should ensure value is an integer between 0 and max allowed length
        return element.tagName === 'number';
    }
    function isCountTracker(element) {
        return (
            PropertyElement.isPrototypeOf(element) &&
            element.name === countTrackerPropertyName &&
            element.isData() &&
            isCountTrackerValue(element.data)
        );
    }
    function hasLengthPropertyWhichIsCountTracker(element) {
        if (ObjectElement.isPrototypeOf(element) === false) {
            return false;
        }
        const countTrackerProperty = element.getProperty(countTrackerPropertyName);
        return (
            countTrackerProperty &&
            countTrackerProperty.isData() &&
            isCountTrackerValue(countTrackerProperty.data)
        );
    }

    Element.refine({
        countTrackerPropertyName,
        hasLengthPropertyWhichIsCountTracker
    });

    // when an indexed property is added/removed inside an Element having a property count tracker
    variation.when(
        function() {
            return (
                PropertyElement.isPrototypeOf(this) &&
                this.isIndex() &&
                this.parentNode &&
                hasLengthPropertyWhichIsCountTracker(this.parentNode)
            );
        },
        function(type) {
            const compositeTrackingItsIndexedProperty = this.parentNode;
            const countTrackerProperty = compositeTrackingItsIndexedProperty.getProperty(countTrackerPropertyName);
            const countTracker = countTrackerProperty.data;

            if (type === 'added') {
                countTracker.mutate(countTracker.value + 1);
            } else if (type === 'removed') {
                countTracker.mutate(countTracker.value - 1);
            }
        }
    );

    // this case exists because array length property is not configurable
    // because of that we cannot redefine it when composing array with arraylike
    // so when there is a already a length property assume it's in sync
    const preventArrayLengthCombine = combineValue.branch(
        function(otherProperty, parentNode) {
            return (
                isCountTracker(this) &&
                hasLengthPropertyWhichIsCountTracker(parentNode)
            );
        },
        function() {
            throw CancelTransformation;
        }
    );
    combineValue.prefer(preventArrayLengthCombine);

    // length count tracker must be in sync with current amount of indexed properties
    // doit se produire pour touch, combine et instantiate mais pas scan
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
                    if (PropertyElement.isPrototypeOf(current) && current.isIndex()) {
                        previous++;
                    }
                    return previous;
                }, 0);
            }
        );
        method.prefer(ensureCountTrackerSync);
    });
})();

/* ---------------- array concatenation ---------------- */
(function() {
    const debugArrayConcat = true;
    const ignoreConcatenedPropertyConflict = conflictsWith.branch(
        function() {
            return (
                PropertyElement.isPrototypeOf(this) &&
                this.isIndex() &&
                this.parentNode.hasLengthPropertyWhichIsCountTracker()
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
                PropertyElement.isPrototypeOf(this) &&
                this.isIndex() &&
                parentNode &&
                parentNode.hasLengthPropertyWhichIsCountTracker()
            );
        },
        function(parentNode) {
            let index = this.value;
            const countTrackerProperty = parentNode.getProperty(parentNode.countTrackerPropertyName);
            const countTrackerData = countTrackerProperty.data;
            const countTrackerValue = countTrackerData.value;

            if (countTrackerValue > 0) {
                const currentIndex = Number(index);
                const concatenedIndex = currentIndex + countTrackerValue;
                index = String(concatenedIndex);
                if (debugArrayConcat) {
                    console.log('index updated from', currentIndex, 'to', concatenedIndex);
                }
            }

            return PropertyDefinition.create(index);
        }
    );
    touchValue.prefer(concatIndexedProperty);
})();

const transformProperties = {
    scanValue,
    variation,
    conflictsWith,
    touchValue,
    touch,
    combineValue,
    combine,
    instantiateValue,
    instantiate,
    construct() {
        return this.instantiate().produce().value;
    }
};

Element.refine(transformProperties);

export {scan};
