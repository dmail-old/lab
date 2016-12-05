/*
raf

les quelques reaction/transformation qui ne sont pas finalisées
traiter effect() que je ne sais pas encore comment traiter avec cette nouvelle approche

effect de Element
effect() {
    const parentNode = this.parentNode;
    if (ObjectPropertyElement.isPrototypeOf(parentNode)) {
        if (parentNode.valueNode === this) {
            parentNode.descriptor.value = this.value;
        } else if (parentNode.getterNode === this) {
            parentNode.descriptor.get = this.value;
        } else if (parentNode.setterNode === this) {
            parentNode.descriptor.set = this.value;
        }
    }
}

effect de ObjectPropertyElement
effect() {
    const object = this.parentNode;
    if (object) {
        // console.log('define property', this.name, '=', this.descriptor, 'on', object.value);
        Object.defineProperty(object.value, this.name, this.descriptor);
    }
}

effect de ArrayPropertyElement (ça va fusionner avec ObjectProperty un truc du genre)
effect() {
    const parentNode = this.parentNode;
    if (parentNode && this.isIndex()) {
        const propertyTrackingEntries = parentNode.getPropertyTrackingEntries();
        if (propertyTrackingEntries) {
            propertyTrackingEntries.incrementValue();
        }
    }
    return ObjectPropertyElement.effect.apply(this, arguments);
}

voir comment on pourras conservér le fait que compose peut s'apeller avec n argument
alors qu'ensuite on va faire comme si on l'apelle avec un seul et éventuellement un parentNode en second
et comment faire en sorte que le compose par défaut laisse prévaloir ce qui est passé que la source
j'avais pensé à une sorte d'élément impossible à contruire genre pureElement
dont la méthode construct throw en disant hey je dois être compose() dabord
et dans le compose on laisse prévaloir le secondElement.procreate au lieu du premier
*/

import {polymorph} from './polymorph.js';
import {
    ObjectElement,
    ObjectPropertyElement
} from './composite.js';
import {
    Transformation,
    CopyTransformation,
    CloneTransformation,
    CancelTransformation,
    // NoTransformation,
    Reaction,
    CancelReaction,
    VanishReaction
} from './transformation.js';

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
const matchNull = match.when(
    function() {
        return this.tagName === 'null';
    },
    function(value) {
        return value === null;
    }
);
['boolean', 'number', 'string', 'symbol', 'undefined'].forEach(function(primitiveName) {
    match.when(
        function() {
            return this.tagName === primitiveName;
        },
        function(value) {
            return typeof value === primitiveName;
        }
    );
});
const matchConstructedBy = match.when(
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

const transform = polymorph();
const transformPrimitive = transform.when(
    function() {
        return this.primitiveMark;
    },
    CopyTransformation.asMethod()
);
const CloneCompositeTransformation = CloneTransformation.extend({
    fill(composite, compositeModel) {
        composite.value = new compositeModel.constructedBy(compositeModel.value.valueOf()); // eslint-disable-line new-cap
        for (let child of compositeModel) {
            child.transform(composite);
        }
    }
});
const transformComposite = transform.when(
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
const transformProperty = transform.when(
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

const react = polymorph();
const reactSomePrimitive = react.when(
    function(element) {
        return this.primitiveMark || element.primitiveMark;
    },
    function(element, parentNode) {
        return VanishReaction.create(this, element, parentNode);
    }
);
const ComposeObjectReaction = Reaction.extend({
    make(firstObject, secondObject) {
        const compositeObject = firstObject.procreate();
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
        const reaction = property.reactWith(conflictualProperty, compositeObject);
        const importedProperty = reaction.produce();
        return importedProperty;
    },

    handleNewProperty(compositeObject, property) {
        const transformation = property.transform(compositeObject);
        const importedProperty = transformation.produce();
        return importedProperty;
    },

    pack() {
        // console.log('freeze the composite', compositeObject.value);
        // Object.freeze(compositeObject.value);
        // cannot freeze, else instance got writable: false
        // and writing instance.property = value will throw
    }
});
const reactBothComposite = react.when(
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
    const lengthProperty = element.getProperty('length');
    return (
        lengthProperty &&
        lengthProperty.descriptor.hasOwnProperty('value') &&
        isCountTrackerValue(lengthProperty.valueNode)
    );
}
// this case exists because array length property is not configurable
// because of that we cannot redefine it when composing array with arraylike
// so when there is a already a length property assume it's in sync
const reactCountTrackerWithExisting = react.when(
    function(otherProperty, parentNode) {
        return (
            isCountTracker(this) &&
            hasLengthPropertyWhichIsCountTracker(parentNode)
        );
    },
    CancelReaction.asMethod()
);
// when a count tracker value becomes the child of a composite
// it must reflects its current amount of indexed properties
// this logic does not even belong to transform or react, it more inside effect()
// const ComposeCountTrackerValue = ComposeReaction.extend({
//     fill(compositeCount, firstCount, secondCount, parentNode) {
//         // we cannot just set it to zero in case length property is added
//         // after indexed properties, so check if there is already indexed properties
//         // this value will be auto incremented by other logic if any indexed property are added after this
//         compositeCount.value = parentNode.children.reduce(function(previous, current) {
//             if (ObjectPropertyElement.isPrototypeOf(current) && current.isIndex()) {
//                 previous++;
//             }
//             return previous;
//         }, 0);
//     }
// });
// const reactWithCountTrackerValue = react.when(
//     function(otherElement) {
//         return (
//             isCountTracker(otherElement.parentNode)
//         );
//     },
//     ComposeBothCountTrackerValue.asMethod()
// );
// now concatenation, it's pretty simple, when both have a count tracker they are concatenable
// if so this propertyCountTracker is used to concat properties
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
const reactBothConcatenable = react.when(
    function(otherElement) {
        return (
            hasLengthPropertyWhichIsCountTracker(this) &&
            hasLengthPropertyWhichIsCountTracker(otherElement)
        );
    },
    ConcatReaction.asMethod()
);
const reactUnconfigurableExistingProperty = react.when(
    function(otherProperty, parentNode) {
        // this case happens with array length property
        // or function name property, in that case we preserve the current property of the compositeObject
        // console.log('own property is not configurable, cannot make it react');

        return (
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
        const compositeProperty = firstProperty.procreate();
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
        return firstConstituant.reactWith(secondConstituant, compositeProperty);
    }
});
const reactBothProperty = react.when(
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
const createObject = construct.when(
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
const defineObjectProperty = construct.when(
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
const delegateOtherProperty = construct.when(
    function() {
        return ObjectPropertyElement.isPrototypeOf(this);
    },
    function(parentNode, index) {
        return CancelTransformation.create(this, parentNode, index);
    }
);
const createPrimitive = construct.when(
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
    transform: transform,
    react: react,
    construct: construct
};

export default defaultMalady;

