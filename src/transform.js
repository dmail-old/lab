/*
raf

- avoir la possibilité de modifier les valeurs via une API du genre element.replace(value)
on utilisera cette api par example pour modifier la velur d'une propriété
on pourra ainsi faire object.getProperty('name').replace('seb');
peut être appeler ça "mutate" et pas "replace"
et bim on peut modifier la valeur 'name' par 'seb' mais cette opération n'est pas immutable
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
        this.descriptor = descriptor;
    }
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
    fill(product) {
        const firstElement = arguments[1];
        const secondElement = arguments.length === 3 ? null : arguments[2];

        // afin d'obtenir un objet final ayant ses propriétés dans l'ordre le plus logique possible
        // on a besoin de plusieurs étapes pour s'assurer que
        // - les propriétés présentent sur l'objet restent définies avant les autres
        // - les propriétés du premier composant sont définies avant celles du second
        const existingChildren = product.children;
        // ptet ici un
        // filteredFirstElementChildren = firstElement.children.filter(function(child) {
        //     return firstElement.filterChild(child, secondElement, product);
        // });
        // même chose pour second ou pas ?
        // secondElement.filterChild(child, firstElement, product)
        // sauf que je ne vois pas pk des enfants du second ne se retrouverait pas dedans au final
        // en plus comment différencier dans ce cas le filterChild appelé sur firstElement et celui
        // appelé sur second
        const firstElementChildren = this.listChildren(product, firstElement);
        const secondElementChildren = secondElement ? this.listChildren(product, secondElement) : [];

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

    listChildren(product, element) {
        // this must always return an array != of element.children
        // because the returned array gets mutated by handleEveryCollision
        // so that that we can after handle remaining child (child without conflict)
        return element.children.filter(product.includeChild, product);
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
            if (PropertyElement.isPrototypeOf(child)) {
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
            if (PropertyElement.isPrototypeOf(child)) {
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
        const value = this.make(...args);
        const product = this.transform(value, ...args);
        if (this.filter(product, ...args)) {
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

// huuum ici aussi on pourrait vouloir dire que pendant le scan, un élément puisse change de type
// selon ce que scanValue retourne
// pour le moment fait en sorte que le test passe mais on va faire ça aussi
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

    transform(value) {
        return scan(value);
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
const CombineTransformation = Transformation.extend({
    parentNodeIndex: 2,

    make(firstElement, secondElement, parentNode) {
        return firstElement.combineValue(secondElement, parentNode);
    },

    transform(combinedValue, firstElement, secondElement) {
        const product = scan(combinedValue);
        product.firstComponent = firstElement;
        product.secondComponent = secondElement;
        return product;
    },

    transformConflictingChild(product, child, conflictualChild) {
        return child.combine(conflictualChild, product);
    },

    transformChild(product, child) {
        return child.touch(product);
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

    transformConflictingChild(product, child, conflictualChild) {
        return child.combine(conflictualChild, product);
    },

    transformChild(product, child) {
        return child.instantiate(product);
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
        return PropertyDefinition.create(this.name, {});
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
instantiateValue.branch(
    PropertyElement.asMatcher(),
    function(parentNode) {
        return this.touchValue(parentNode);
    }
);
// delegate property which hold primitives
// même chose, besoin d'un truc spécial pour s'arrêter ici
// instantiateType.branch(
//     function() {
//         return (
//             DataPropertyElement.isPrototypeOf(this) &&
//             this.data.primitiveMark
//         );
//     },
//     function() {
//         return null;
//     }
// );

// pour ça on a besoin de pouvoir empêcher la combinaison, voir comment parce que retourner undefined
// ne fonctionne pas, y'aura donc ptet une fonction spéciale pour désactiver au lieu du retrun null qu'on utilisait avant

// this case happens with array length property
// or function name property, in that case we preserve the current property of the compositeObject
// combineType.branch(
//     function(otherProperty, parentNode) {
//         // console.log('own property is not configurable, cannot make it react');
//         return (
//             PropertyElement.isPrototypeOf(this) &&
//             this.parentNode === parentNode &&
//             this.canConfigure() === false
//         );
//     },
//     function() {
//         return null;
//     }
// );

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
    // combineType.branch(
    //     function(otherProperty, parentNode) {
    //         return (
    //             isCountTracker(this) &&
    //             hasLengthPropertyWhichIsCountTracker(parentNode)
    //         );
    //     },
    //     function() {
    //         return null;
    //     }
    // );

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

            return index;
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
