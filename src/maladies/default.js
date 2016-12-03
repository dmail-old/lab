/*
raf

les quelques reaction/transformation qui ne sont pas finalisées
traiter effect() que je ne sais pas encore comment traiter avec cette nouvelle approche

la fonction importChildren
bon y'a juste un truc c'est que le fait de copier un élément forcait ses descendants à être copié
je ne suis pas forcément daccord avec ça, copier un élément apelle transform sur ses decendants qui décide d'être copié ou cloné ou autre

function importChildren(composite, otherComposite) {
    for (let child of otherComposite) {
        const constituentTransformation = constituent.transform(composite);
        constituentTransformation.produce();
    }
}
*/

import {polymorph} from './polymorph.js';
import {
    ObjectElement,
    ObjectPropertyElement,
    ArrayElement
} from './composite.js';
import {
    Transformation,
    CopyTransformation,
    CloneTransformation,
    CancelTransformation,
    NoTransformation,
    Reaction,
    CancelReaction,
    VanishReaction
} from './transformation.js';

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
    function(parentNode, index) {
        return CopyTransformation.create(this, parentNode, index);
    }
);
const transformArray = transform.when(
    function() {
        ArrayElement.isPrototypeOf(this);
    },
    function(parentNode, index) {
        return CloneTransformation.extend({
            fill(array, arrayModel) {
                array.value = [];
                array.importChildren(arrayModel);
            }
        }).create(this, parentNode, index);
    }
);
const transformObject = transform.when(
    function() {
        // or this.tagName === 'Object'
        return Object.getPrototypeOf(this) === ObjectElement;
    },
    function(parentNode, index) {
        return CloneTransformation.extend({
            fill(object, objectModel) {
                object.value = {};
                object.importChildren(objectModel);
            }
        }).create(this, parentNode, index);
    }
);
const transformComposite = transform.when(
    function() {
        return ObjectElement.isPrototypeOf(this);
    },
    function(parentNode, index) {
        return CloneTransformation.extend({
            fill(composite, compositeModel) {
                composite.value = new compositeModel.constructedBy(compositeModel.value.valueOf()); // eslint-disable-line new-cap
                composite.importChildren(compositeModel);
            }
        }).create(this, parentNode, index);
    }
);
const transformIndexedArrayProperty = transform.when(
    function(parentNode, index) {
        // we concat only the second array indexed properties
        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            ArrayElement.isPrototypeOf(parentNode) &&
            this.isIndex() &&
            index > 0
        );
    },
    function(parentNode, index) {
        // ah oui ceci est dû au fait que la reaction peut être la concaténation
        // mais en fait le code ci-dessous va sûrement passer dans le cas reactWith de deux arrayProperty
        return CopyTransformation.extend({
            fill(arrayProperty, arrayPropertyModel, parentNode) {
                // parentElement can be :
                // - an object when you compose object + array and it becomes an array like after composition
                // - an arraylike when you composed object + array or that the object was already an array like
                // - an array when you compose array + array
                // as a consequence we check if parentELement has a property trackingEntries we can use to concat
                // when we copy a copied array which was frozen we got a prob

                // we must concat not using parentElement because its the subject of the concatenation
                // we must use parentElement component
                const propertyTrackingEntries = parentNode.firstComponent.getPropertyTrackingEntries();

                if (propertyTrackingEntries) {
                    // the length property is available on refine, before that the copied array does not have any property
                    // when combining object + array the result is an object so it's does not have a length property
                    // he will get the length property from the combined array but it's not available already if length
                    // property is not the first copied property
                    // moreover you may compose arrayLike with array
                    // and in that case arrayLike have a length property that will be set during combineObject.refine()
                    const length = propertyTrackingEntries.propertyValue;
                    const conflictualIndex = Number(arrayProperty.name);
                    const concatenedIndex = conflictualIndex + length;
                    const concatenedIndexAsString = String(concatenedIndex);

                    arrayProperty.value = concatenedIndexAsString;
                    // if (debugArrayConcat) {
                    //     console.log('index updated from', conflictualIndex, 'to', concatenedIndex);
                    // }
                } else {
                    arrayProperty.value = arrayPropertyModel.value;
                }

                arrayProperty.descriptor = Object.assign({}, arrayPropertyModel.descriptor);
                // during importChildren, import them using NoTransformation (why??)
                // this is the purpose of createNestedCopy below
                arrayProperty.importChildren(arrayPropertyModel);
            },

            createNestedCopy(...args) {
                return NoTransformation.create(...args);
            }
        }).create(this, parentNode, index);
    }
);
const transformProperty = transform.when(
    function() {
        return ObjectPropertyElement.isPrototypeOf(this);
    },
    function(parentNode, index) {
        return CloneTransformation.extend({
            fill(property, propertyModel) {
                property.value = propertyModel.value;
                property.descriptor = Object.assign({}, propertyModel.descriptor);
                property.importChildren(propertyModel);
            }
        }).create(this, parentNode, index);
    }
);
export {
    transformPrimitive,
    transformArray,
    transformObject,
    transformComposite,
    transformIndexedArrayProperty,
    transformProperty
};

const react = polymorph();
const reactSomePrimitive = react.when(
    function(element) {
        return this.primitiveMark || element.primitiveMark;
    },
    function(element, parentNode, value) {
        return VanishReaction.create(this, element, parentNode, value);
    }
);
const reactBothComposite = react.when(
    function(otherElement) {
        return ObjectElement.isPrototypeOf(this) && ObjectElement.isPrototypeOf(otherElement);
    },
    function(compositeElement, parentNode, index) {
        return Reaction.extend({
            make(firstObject, secondObject) {
                const compositeObject = firstObject.procreate();
                compositeObject.firstComponent = firstObject;
                compositeObject.secondComponent = secondObject;

                return compositeObject;
            },

            fill(compositeObject, firstComponent, secondComponent) {
                compositeObject.value = {};
                compositeObject.readProperties(compositeObject.value);

                const ownProperties = compositeObject.children;
                const unhandledSecondProperties = secondComponent.children.slice();
                for (let firstProperty of firstComponent) {
                    const ownPropertyIndex = this.findConflictualPropertyIndex(ownProperties, firstProperty);
                    if (ownPropertyIndex > -1) {
                        const ownProperty = ownProperties[ownPropertyIndex];
                        firstProperty = this.handlePropertyCollision(compositeObject, ownProperty, firstProperty);
                        if (!firstProperty) {
                            continue;
                        }
                    }

                    const secondPropertyIndex = this.findConflictualPropertyIndex(
                        unhandledSecondProperties,
                        firstProperty
                    );
                    if (secondPropertyIndex === -1) {
                        this.handleNewProperty(compositeObject, firstProperty, 0);
                    } else {
                        // handle the conflict and mark the property as handled
                        const conflictualSecondProperty = unhandledSecondProperties[secondPropertyIndex];
                        unhandledSecondProperties.splice(secondPropertyIndex, 1);
                        this.handlePropertyCollision(compositeObject, firstProperty, conflictualSecondProperty);
                    }
                }

                for (let secondProperty of unhandledSecondProperties) {
                    const ownPropertyIndex = this.findConflictualPropertyIndex(ownProperties, secondProperty);
                    if (ownPropertyIndex > -1) {
                        const ownProperty = ownProperties[ownPropertyIndex];
                        this.handlePropertyCollision(compositeObject, ownProperty, secondProperty);
                    } else {
                        this.handleNewProperty(compositeObject, secondProperty, 1);
                    }
                }
            },

            findConflictualPropertyIndex(properties, possiblyConflictualProperty) {
                return properties.findIndex(function(property) {
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

            handleNewProperty(compositeObject, property, index) {
                const transformation = property.transform(compositeObject, index);
                const importedProperty = transformation.produce();
                return importedProperty;
            },

            pack() {
                // console.log('freeze the composite', compositeObject.value);
                // Object.freeze(compositeObject.value);
                // cannot freeze, else instance got writable: false
                // and writing instance.property = value will throw
            }
        }).create(this, compositeElement, parentNode, index);
    }
);
const reactBothPropertyInsideArray = react.when(
    function(otherProperty, parentNode) {
        return ObjectPropertyElement.isPrototypeOf(this) && ArrayElement.isPrototypeOf(parentNode);
    },
    function() {
        // en gros il faut modifier combineObject pour changer detectPropertyConflict
        // par celui ci-dessous

        // detectPropertyConflict(property, otherProperty) {
        //     const propertyHaveSameName = property.name === otherProperty.name;
        //     // ignore conflict when two indexed property wants to be concatened
        //     if (propertyHaveSameName && property.isIndex()) {
        //         if (debugArrayConcat) {
        //             console.log('ignoring conflict for', this.descriptor.value, 'because it will be concatened');
        //         }
        //         return false;
        //     }
        //     return propertyHaveSameName;
        // }
    }
);
const reactArrayLengthInsideUntrackedLength = react.when(
    function(otherProperty, parentNode) {
        // on doit s'assurer soit que length est la dernière propriété que l'on met
        // soit que incrementValue met à jour length avec effect()
        // parce qu'on est pas sur que la valeur finale de length
        // soit bien firstLength + secondLength
        // il suffit qu'une des entrées du tableau ne souhaite pas être concat pour tout niquer

        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            ArrayElement.isPrototypeOf(this.parentNode) &&
            this.name === 'length' &&
            !parentNode.getPropertyTrackingEntries()
        );
    },
    function() {
        // faudrais réutiliser combineProperty enfin ptet ou pas en tous cas on doit reset length à zéro
        return Reaction.extend({
            fill() {
                this.value = 0;
            }
        });
    }
);
const reactArrayLength = react.when(
    function() {
        // we disable reaction concerning the length property as it would mutate the array
        // instead we manually increase the length property when indexed property are added
        // because length property is non configurable by default this check is not mandatory
        // as length would be ignored by SafeCombineProperty
        // but this is "luck" so don't rely on luck, be explicit
        // if tomorrow JS engine decide length property is configurable this will still work

        return (
            ObjectPropertyElement.isPrototypeOf(this) &&
            ArrayElement.isPrototypeOf(this.parentNode) &&
            this.name === 'length'
        );
    },
    function() {
        return CancelReaction.create();
    }
);
const reactUnconfigurableProperty = react.when(
    function(otherProperty, parentNode) {
        // this case happens with array length property
        // or function name property, in that case we preserve the current property of the compositeObject
        // console.log('own property is not configurable, cannot make it react');

        return (
            this.descriptor.configurable === false &&
            this.parentNode === parentNode
        );
    },
    function() {
        return CancelReaction.create();
    }
);
const reactBothProperty = react.when(
    function(otherElement) {
        return ObjectPropertyElement.isPrototypeOf(this) && ObjectPropertyElement.isPrototypeOf(otherElement);
    },
    function(otherProperty, parentNode, index) {
        return Reaction.extend({
            make(firstProperty, secondProperty) {
                // const firstName = firstProperty.name;
                const secondName = secondProperty.name;
                const combinedName = secondName;
                const compositeProperty = firstProperty.procreate(combinedName);
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
        }).create(this, otherProperty, parentNode, index);
    }
);
export {
    reactSomePrimitive,
    reactBothComposite,
    reactBothPropertyInsideArray,
    reactArrayLengthInsideUntrackedLength,
    reactArrayLength,
    reactUnconfigurableProperty,
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

