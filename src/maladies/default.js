/*
raf

*/

import {polymorph} from '../polymorph.js';
import {Element} from '../lab.js';
import {
    ObjectElement,
    ObjectPropertyElement
} from '../composite.js';
import {
    Transformation,
    Reaction
} from '../transformation.js';

function isCountTrackerValue(element) {
    // we should check the value is an integer between 0 and max allowed length
    return element.valueNode.tagName === 'number';
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

// const ComposeReaction = Reaction.extend({
//     make(firstElement) {
//         return firstElement.procreate();
//     }
// });
// const CopyPropertyTransformation = CopyTransformation.extend({
//     make(property) {
//         const compositeProperty = property.procreate();
//         compositeProperty.value = property.value;
//         compositeProperty.descriptor = property.descriptor;

//         return compositeProperty;
//     },

//     fill(compositeProperty, property) {
//         for (let child of property) {
//             child.transform(compositeProperty);
//         }
//     }
// });

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

const make = polymorph();
// now useless
// make.branch(
//     function(secondElement) {
//         return (
//             Object.getPrototypeOf(this) === Element &&
//             Boolean(secondElement)
//         );
//     },
//     function(secondElement) {
//         // pureElement reaction let the second element prevails
//         return secondElement.createConstructor.apply(this, arguments);
//     }
// );
make.branch(
    null,
    function() {
        return this.createConstructor.apply(this, arguments);
    }
);

const cloneValue = polymorph();
cloneValue.branch(
    function() {
        return this.tagName === 'Object';
    },
    function() {
        return {};
    }
);
cloneValue.branch(
    function() {
        return this.tagName === 'Array';
    },
    function() {
        return [];
    }
);
cloneValue.branch(
    function() {
        return ObjectElement.isPrototypeOf(this);
    },
    function() {
        return new this.constructedBy(this.value.valueOf()); // eslint-disable-line new-cap
    }
);

const transform = polymorph();
const CopyTransformation = Transformation.extend({
    make(element) {
        return element.make();
    },

    fill(element, elementModel) {
        element.value = elementModel.value;
        for (let child of elementModel) {
            child.transform(element);
        }
    }
});
const transformPrimitive = transform.branch(
    function() {
        return this.primitiveMark;
    },
    CopyTransformation.asMethod()
);
const CloneTransformation = Transformation.extend({
    make(element) {
        return element.make();
    }
});
const CloneCompositeTransformation = CloneTransformation.extend({
    fill(composite, compositeModel) {
        composite.value = compositeModel.cloneValue();
        for (let child of compositeModel) {
            child.transform(composite);
        }
    }
});
const transformComposite = transform.branch(
    function() {
        return ObjectElement.isPrototypeOf(this);
    },
    CloneCompositeTransformation.asMethod()
);
const ClonePropertyTransformation = CloneTransformation.extend({
    fill(property, propertyModel) {
        property.value = propertyModel.value;
        property.descriptor = Object.assign({}, propertyModel.descriptor);
        for (let child of propertyModel) {
            child.transform(property);
        }
    }
});
const transformProperty = transform.branch(
    function() {
        return ObjectPropertyElement.isPrototypeOf(this);
    },
    ClonePropertyTransformation.asMethod()
);
export {
    transformPrimitive,
    transformComposite,
    transformProperty
};

const effect = polymorph();
// when the produced element in inside a property it impacts its property descriptor
effect.when(
    function() {
        return (
            this.parentNode &&
            ObjectPropertyElement.isPrototypeOf(this.parentNode)
        );
    },
    function() {
        const property = this.parentNode;
        if (this === property.valueNode) {
            property.descriptor.value = this.value;
        } else if (this === property.getterNode) {
            property.descriptor.get = this.value;
        } else if (this === property.setterNode) {
            property.descriptor.set = this.value;
        }
    }
);
// when the produced element is a property it impacts the parent composite by setting the property on it
effect.when(
    function() {
        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            this.parentNode
        );
    },
    function() {
        const composite = this.parentNode;
        // console.log('define property', this.name, '=', this.descriptor, 'on', object.value);
        Object.defineProperty(composite.value, this.name, this.descriptor);
    }
);
// the following case is disabled because freezing the value has an impact so that doing
// instance = Object.create(this.value); instance.property = true; will throw
// effect.when(
//     function() {
//         return ObjectElement.isPrototypeOf(this);
//     },
//     function() {
//         Object.freeze(this.value);
//     }
// );
// when the produced element is an indexed property, increment the property count tracker value
const incrementLength = effect.when(
    function() {
        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            this.parentNode &&
            hasLengthPropertyWhichIsCountTracker(this.parentNode)
        );
    },
    function() {
        this.parentNode.getProperty('length').incrementValue();
    }
);
effect.prefer(incrementLength);
// when a count tracker value becomes the child of a composite
// it must reflects its current amount of indexed properties
const syncLengthValue = effect.when(
    function() {
        return (
            this.parentNode &&
            isCountTracker(this.parentNode)
        );
    },
    function() {
        this.value = this.parentNode.children.reduce(function(previous, current) {
            if (ObjectPropertyElement.isPrototypeOf(current) && current.isIndex()) {
                previous++;
            }
            return previous;
        }, 0);
    }
);
// always syncLengthValue doing sthing else
effect.prefer(syncLengthValue);

const react = polymorph();
const VanishReaction = Reaction.extend({
    constructor(firstElement, secondElement, parentNode) {
        return secondElement.transform(parentNode);
    }
});
react.branch(
    function() {
        return Object.getPrototypeOf(this) === Element;
    },
    VanishReaction.asMethod()
);
const reactSomePrimitive = react.branch(
    function(element) {
        return this.primitiveMark || element.primitiveMark;
    },
    VanishReaction.asMethod()
);
const ComposeObjectReaction = Reaction.extend({
    make(firstObject, secondObject) {
        const compositeObject = firstObject.make(secondObject);
        compositeObject.firstComponent = firstObject;
        compositeObject.secondComponent = secondObject;

        return compositeObject;
    },

    fill(compositeObject, firstComponent, secondComponent) {
        const compositeValue = new compositeObject.constructedBy(); // eslint-disable-line new-cap
        const ownProperties = compositeObject.readProperties(compositeValue);

        compositeObject.value = compositeValue;

        // afin d'obtenir un objet final ayant ses propriétés dans l'ordre le plus logique possible
        // on a besoin de plusieurs étapes pour s'assurer que
        // - les propriétés présentent sur l'objet restent définies avant les autres
        // - les propriétés du premier composant sont définies avant celles du second

        // 1 : traite les propriétées existantes en conflit avec firstComponent
        const unhandledFirstProperties = firstComponent.children.slice();
        let firstPropertyIndex = 0;
        for (let firstProperty of firstComponent) {
            const ownProperty = this.findConflictualProperty(ownProperties, firstProperty);
            if (ownProperty) {
                unhandledFirstProperties.splice(firstPropertyIndex, 1);
                this.handlePropertyCollision(compositeObject, ownProperty, firstProperty);
            }
            firstPropertyIndex++;
        }
        // 2: traite les propriétées existantes en conflit avec secondComponent
        const unhandledSecondProperties = secondComponent.children.slice();
        let secondPropertyIndex = 0;
        for (let secondProperty of secondComponent) {
            const ownProperty = this.findConflictualProperty(ownProperties, secondProperty);
            if (ownProperty) {
                unhandledSecondProperties.splice(secondPropertyIndex, 1);
                this.handlePropertyCollision(compositeObject, ownProperty, secondProperty);
            }
            secondPropertyIndex++;
        }
        // 3: traite les propriétés de firstComponent en conflit avec secondComponent
        let unhandledFirstPropertyIndex = 0;
        for (let unhandledFirstProperty of unhandledFirstProperties) {
            const secondProperty = this.findConflictualProperty(unhandledSecondProperties, unhandledFirstProperty);
            if (secondProperty) {
                unhandledFirstProperties.splice(unhandledFirstPropertyIndex, 1);
                this.handlePropertyCollision(compositeObject, unhandledFirstProperty, secondProperty);
            }
            unhandledFirstPropertyIndex++;
        }
        // 4: traite les propriétés de secondComponent en conflit avec firstComponent
        // (si la détection de conflit se fait sur le nom cette boucle ne sers à rien puisqe l'étape 3 est équivalente)
        let unhandledSecondPropertyIndex = 0;
        for (let unhandledSecondProperty of unhandledSecondProperties) {
            const firstProperty = this.findConflictualProperty(unhandledFirstProperties, unhandledSecondProperty);
            if (firstProperty) {
                unhandledSecondProperties.splice(unhandledSecondPropertyIndex, 1);
                this.handlePropertyCollision(compositeObject, firstProperty, unhandledSecondProperty);
            }
            unhandledSecondPropertyIndex++;
        }
        // 5: traite les propriétés de firstComponent sans conflit
        for (let unhandledFirstProperty of unhandledFirstProperties) {
            this.handleNewProperty(compositeObject, unhandledFirstProperty);
        }
        // 6: traite les propriétés de secondComponent sans conflit
        for (let unhandledSecondProperty of unhandledSecondProperties) {
            this.handleNewProperty(compositeObject, unhandledSecondProperty);
        }
    },

    findConflictualProperty(properties, possiblyConflictualProperty) {
        return properties.find(function(property) {
            return this.detectPropertyConflict(property, possiblyConflictualProperty);
        }, this);
    },

    detectPropertyConflict(property, otherProperty) {
        return property.name === otherProperty.name;
    },

    handlePropertyCollision(compositeObject, property, conflictualProperty) {
        // here we could impvoe perf by finding the appropriat reaction and if the reaction
        // is to clone currentProperty we can do nothing because it's already there
        const reaction = property.react(conflictualProperty, compositeObject);
        const importedProperty = reaction.produce();
        return importedProperty;
    },

    handleNewProperty(compositeObject, property) {
        const transformation = property.transform(compositeObject);
        const importedProperty = transformation.produce();
        return importedProperty;
    }
});
const reactBothComposite = react.branch(
    function(otherElement) {
        return (
            ObjectElement.isPrototypeOf(this) &&
            ObjectElement.isPrototypeOf(otherElement)
        );
    },
    ComposeObjectReaction.asMethod()
);

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

// this case exists because array length property is not configurable
// because of that we cannot redefine it when composing array with arraylike
// so when there is a already a length property assume it's in sync
const CancelReaction = Reaction.extend({
    produce() {} // no nothing
});
const reactCountTrackerWithExisting = react.branch(
    function(otherProperty, parentNode) {
        return (
            isCountTracker(this) &&
            hasLengthPropertyWhichIsCountTracker(parentNode)
        );
    },
    CancelReaction.asMethod()
);
const debugArrayConcat = false;
const TransformConcatProperty = CopyTransformation.extend({
    fill(indexedProperty, parentNode) {
        CopyTransformation.fill.apply(this, arguments);
        const length = parentNode.getProperty('length').propertyValue;

        if (length > 0) {
            const currentIndex = Number(indexedProperty.name);
            const concatenedIndex = currentIndex + length;
            const concatenedIndexAsString = String(concatenedIndex);

            indexedProperty.value = concatenedIndexAsString;
            if (debugArrayConcat) {
                console.log('index updated from', currentIndex, 'to', concatenedIndex);
            }
        }
    }
});
const ConcatReaction = ComposeObjectReaction.extend({
    findConflictualProperty(properties, possiblyConflictualProperty) {
        if (possiblyConflictualProperty.isIndex()) {
            if (debugArrayConcat) {
                console.log(
                    'ignoring conflict for',
                    possiblyConflictualProperty.descriptor.value,
                    'because it will be concatened'
                );
            }
            return false;
        }
        return ComposeObjectReaction.findConflictualProperty.apply(this, arguments);
    },

    handleNewProperty(compositeObject, property) {
        if (property.isIndex()) {
            return TransformConcatProperty.create(property, compositeObject).produce();
        }
        return ComposeObjectReaction.handleNewProperty.apply(this, arguments);
    }
});
const reactBothConcatenable = react.branch(
    function(otherElement) {
        return (
            hasLengthPropertyWhichIsCountTracker(this) &&
            hasLengthPropertyWhichIsCountTracker(otherElement)
        );
    },
    ConcatReaction.asMethod()
);
const reactUnconfigurableExistingProperty = react.branch(
    function(otherProperty, parentNode) {
        // this case happens with array length property
        // or function name property, in that case we preserve the current property of the compositeObject
        // console.log('own property is not configurable, cannot make it react');

        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            this.descriptor.configurable === false &&
            this.parentNode === parentNode
        );
    },
    CancelReaction.asMethod()
);
const ComposePropertyReaction = Reaction.extend({
    make(firstProperty, secondProperty) {
        // const firstName = firstProperty.name;
        const secondName = secondProperty.name;
        const combinedName = secondName;
        const compositeProperty = firstProperty.make(secondProperty);
        compositeProperty.value = combinedName;
        // const firstDescriptor = firstProperty.descriptor;
        const secondDescriptor = secondProperty.descriptor;
        const compositeDescriptor = Object.assign({}, secondDescriptor);
        compositeProperty.descriptor = compositeDescriptor;

        return compositeProperty;
    },

    fill(compositeProperty, firstComponent, secondComponent) {
        const firstDescriptor = firstComponent.descriptor;
        const secondDescriptor = secondComponent.descriptor;
        const firstType = firstDescriptor.hasOwnProperty('value') ? 'value' : 'accessor';
        const secondType = secondDescriptor.hasOwnProperty('value') ? 'value' : 'accessor';
        const compositePropertyType = firstType + '-' + secondType;

        if (compositePropertyType === 'value-value') {
            this.handleConstituant(compositeProperty, 'valueNode', firstComponent, secondComponent);
        } else if (compositePropertyType === 'accessor-value') {
            this.handleConstituant(compositeProperty, 'valueNode', secondComponent);
        } else if (compositePropertyType === 'value-accessor') {
            this.handleConstituant(compositeProperty, 'getterNode', secondComponent);
            this.handleConstituant(compositeProperty, 'setterNode', secondComponent);
        } else if (compositePropertyType === 'accessor-accessor') {
            this.handleConstituant(compositeProperty, 'getterNode', firstComponent, secondComponent);
            this.handleConstituant(compositeProperty, 'setterNode', firstComponent, secondComponent);
        }
    },

    handleConstituant(compositeProperty, constituantName, firstComponent, secondComponent) {
        const firstConstituant = firstComponent[constituantName];
        if (firstConstituant) {
            const secondConstituant = secondComponent ? secondComponent[constituantName] : null;

            let reaction;
            if (firstConstituant && secondConstituant) {
                reaction = this.handleConstituantReaction(
                    compositeProperty,
                    firstConstituant,
                    secondConstituant,
                    constituantName
                );
            } else if (firstComponent) {
                reaction = firstConstituant.transform(compositeProperty);
            }

            reaction.produce();
        }
    },

    handleConstituantReaction(compositeProperty, firstConstituant, secondConstituant) {
        return firstConstituant.react(secondConstituant, compositeProperty);
    }
});
const reactBothProperty = react.branch(
    function(otherElement) {
        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            ObjectPropertyElement.isPrototypeOf(otherElement)
        );
    },
    ComposePropertyReaction.asMethod()
);
react.prefer(
    reactBothConcatenable,
    reactBothComposite
);

export {
    reactSomePrimitive,
    reactBothComposite,
    reactBothConcatenable,
    reactCountTrackerWithExisting,
    reactUnconfigurableExistingProperty,
    reactBothProperty
};

const construct = polymorph();
construct.branch(
    function() {
        return Object.getPrototypeOf(this) === Element;
    },
    function() {
        throw new Error('pure element cannot be constructed');
    }
);
const createObject = construct.branch(
    function() {
        return ObjectElement.isPrototypeOf(this);
    },
    function(parentNode, index) {
        return Transformation.extend({
            fill(element, elementModel) {
                element.value = Object.create(elementModel.value);
                // ici ce serait plutot construct children non????
                element.importChildren(elementModel);
            }
        }).create(this, parentNode, index);
    }
);
const defineObjectProperty = construct.branch(
    function() {
        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            this.descriptor.hasOwnProperty('value') &&
            ObjectElement.isPrototypeOf(this.valueNode)
        );
    },
    function(parentNode, index) {
        return Transformation.extend({
            fill() {

            }
        }).create(this, parentNode, index);
    }
);
const CancelTransformation = Transformation.extend({
    produce() {}
});
const delegateOtherProperty = construct.branch(
    function() {
        return ObjectPropertyElement.isPrototypeOf(this);
    },
    CancelTransformation.asMethod()
);
const createPrimitive = construct.branch(
    function() {
        return this.primitiveMark;
    },
    function() {
        return this.value;
    }
);
export {
    createObject,
    defineObjectProperty,
    delegateOtherProperty,
    createPrimitive
};

const defaultMalady = {
    match: match,
    make: make,
    cloneValue: cloneValue,
    transform: transform,
    react: react,
    effect: effect,
    construct: construct
};

export default defaultMalady;

