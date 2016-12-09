/*
raf

- maintenant que property.value = une instance de PropertyDefinition faut gérer
ces cas là où on combine/touch les propriétés
pourra être instancié
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
*/

// quelque chose manque : une propriété configurable combiné avec un non configurable
// il faut aussi régléer ça
// la combinaison des noms des deux propriétés aussi
// autrement dit configurable, writable etc tout ça va devenir un child pour chaque propriété

import util from '../util.js';
import {polymorph} from '../polymorph.js';
import {Element} from '../lab.js';
import {
    ObjectElement,
    PropertyElement,
    DataPropertyElement,
    AccessorPropertyElement,
    ArrayElement,
    FunctionElement
} from '../composite.js';

function isCountTrackerValue(element) {
    // we should ensure value is an integer between 0 and max allowed length
    return element.tagName === 'number';
}
function isCountTracker(element) {
    return (
        DataPropertyElement.isPrototypeOf(element) &&
        element.name === 'length' &&
        isCountTrackerValue(element.data)
    );
}
function hasLengthPropertyWhichIsCountTracker(element) {
    if (ObjectElement.isPrototypeOf(element) === false) {
        return false;
    }
    const lengthProperty = element.getProperty('length');
    return (
        lengthProperty &&
        DataPropertyElement.isPrototypeOf(lengthProperty) &&
        isCountTrackerValue(lengthProperty.data)
    );
}
function cloneFunction(fn) {
    // a true clone must handle new  https://gist.github.com/dmail/6e639ac50cec8074a346c9e10e76fa65
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
        return element.children.filter(function(child) {
            return product.ignoreChild(child) === false;
        });
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
            // console.log('set', property.name, '=', property.descriptor.value, 'on', objectElement.value);
            property.install(objectElement);
        } else if (type === 'removed') {
            property.uninstall(objectElement);
        }
    }
);
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
        const countTrackerProperty = compositeTrackingItsIndexedProperty.getProperty('length');
        const countTracker = countTrackerProperty.data;

        if (type === 'added') {
            countTracker.mutate(countTracker.value + 1);
        } else if (type === 'removed') {
            countTracker.mutate(countTracker.value - 1);
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
        return this.name;
    }
);

const touchType = polymorph();
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
        PropertyElement.isPrototypeOf(this) &&
        PropertyElement.isPrototypeOf(otherElement)
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
// property use otherProperty touched value (inherits name)
combineValue.branch(
    bothProperty,
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
            PropertyElement.isPrototypeOf(this) &&
            this.parentNode === parentNode &&
            this.canConfigure() === false
        );
    },
    function() {
        return null;
    }
);

// data property ignores getter & setter
DataPropertyElement.refine({
    ignoreChild(child) {
        return (
            child.descriptorName === 'getter' ||
            child.descriptorName === 'setter'
        );
    }
});
// accessor property ignores writable & values
AccessorPropertyElement.refine({
    ignoreChild(child) {
        return (
            child.descriptorName === 'writable' ||
            child.descriptorName === 'value'
        );
    }
});
// other child will be handled normally
Element.refine({
    ignoreChild() {
        return false;
    }
});

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
// objects let first type prevails
combineType.branch(
    ObjectElement.asMatcher(),
    function(otherElement, parentNode) {
        return this.make(this.combineValue(otherElement, parentNode));
    }
);

const conflictsWith = polymorph();
// property children conflict is special, only child of the same descriptorName are in conflict
conflictsWith.branch(
    function(otherChild) {
        return (
            PropertyElement.isPrototypeOf(this.parentNode) &&
            PropertyElement.isPrototypeOf(otherChild.parentNode)
        );
    },
    function(otherChild) {
        return this.descriptorName === otherChild.descriptorName;
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
            DataPropertyElement.isPrototypeOf(this) &&
            this.data.primitiveMark
        );
    },
    function() {
        return null;
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
instantiateValue.branch(
    PropertyElement.asMatcher(),
    function(parentNode) {
        return this.touchValue(parentNode);
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
                if (PropertyElement.isPrototypeOf(current) && current.isIndex()) {
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
            PropertyElement.isPrototypeOf(this) &&
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
            PropertyElement.isPrototypeOf(this) &&
            this.isIndex() &&
            hasLengthPropertyWhichIsCountTracker(parentNode)
        );
    },
    function(parentNode) {
        let index = this.value;
        const lengthProperty = parentNode.getProperty('length');
        const lengthData = lengthProperty.data;
        const length = lengthData.value;

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

