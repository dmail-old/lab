/* eslint-disable no-use-before-define */

import {Lab, Element, Infection} from './lab.js';
import {PrimitiveProperties} from './primitive.js';
import {
    NoTransformation,
    CopyTransformation,
    createDynamicTransformation,
    CloneTransformation,
    Reaction,
    CancelReaction,
    createDynamicReaction
} from './transformation.js';

function createConstructedByProperties(Constructor) {
    return {
        match(value) {
            return Constructor.prototype.isPrototypeOf(value);
        },

        refineClone(element) {
            this.value = new Constructor(element.value.valueOf());
        }
    };
}

const ObjectElement = Element.extend('Object', createConstructedByProperties(Object), {
    fill(value) {
        this.readProperties(value);
        // freeze after so that property descriptor remains intact
        // Object.freeze(value);
    },

    readProperties(value) {
        return this.listProperties(value).map(function(name) {
            return this.readProperty(value, name);
        }, this);
    },

    listProperties(value) {
        return Object.getOwnPropertyNames(value);
    },

    readProperty(value, name) {
        const propertyNode = this.createProperty(name);
        this.addProperty(propertyNode);

        const descriptor = Object.getOwnPropertyDescriptor(value, name);
        if (descriptor === null || descriptor === undefined) {
            throw new Error('value has no property named ' + name + ' (value : ' + value + ' )');
        }
        propertyNode.fill(descriptor);

        return propertyNode;
    },

    createProperty(name) {
        return ObjectPropertyElement.create(name);
    },

    addProperty(property) {
        return this.appendChild(property);
    },

    hasProperty(name) {
        return this.children.some(function(property) {
            return property.name === name;
        });
    },

    getProperty(name) {
        return this.children.find(function(property) {
            return property.name === name;
        });
    },

    compile() {
        // c'est cool on infect les objets mais
        // il manque les tableaux qui doivent aussi être infecté (même si pour le coup on va pas utiliser Object.create sur un tableau a priori)
        // de plus l'infection par du principe qu'on infecte tout ce qui est en dessous
        // mais que se passe-til si on cherche à infecter une primitive ?
        // on ignorer l'infection dans ce cas là (ce qui est le cas puisque reactWith empêche les réaction entre composite et primitive
        const instantiationInfection = Infection.create({
            fillClone(element) {
                this.value = Object.create(element.value);
                // I can also disable the need to defineProperty because they are inherited
                // it's a bit complex for now so they will be defined
                // however later we want to define only composite properties, other properties can be inherited
            }
        });
        instantiationInfection.carriageable = true;

        this.infect(instantiationInfection);
        const instanceComposite = this.compose();
        this.cure(instantiationInfection);

        return instanceComposite.value;
    },

    construct() {
        const instance = this.compile();

        // call every constructor on instance
        if (this.value.hasOwnProperty('constructor')) {
            instance.constructor.apply(instance, arguments);
        }

        return instance;
    }
});
const CombineObjectReaction = Reaction.extend({
    maker(firstObject, secondObject) {
        const compositeObject = firstObject.procreate();
        compositeObject.firstComponent = firstObject;
        compositeObject.secondComponent = secondObject;

        return compositeObject;
    },

    filler(compositeObject, ...args) {
        compositeObject.fillComposite(...args);
        compositeObject.readProperties(compositeObject.value);
    },

    packager(compositeObject, firstComponent, secondComponent) {
        // compositeObject is infected BUT is the infection is carriageable
        // alors il faut transmettre l'infection, si cette infection touche un élément de différente nature
        // et que l'infection ne présente pas de mutation connu pour ce type d'élément
        // alors l'élément est porteur sain de cette infection qui pourras en rvanche se transmettre
        // au élément de même type en contact direct/indirect avec cet éléménet

        // console.log('refine the composite', compositeObject.value);
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

            const secondPropertyIndex = this.findConflictualPropertyIndex(unhandledSecondProperties, firstProperty);
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

        // console.log('freeze the composite', compositeObject.value);
        // Object.freeze(compositeObject.value);
        // cannot freeze, else instance got writable: false
        // and writing instance.property = value will throw
    },

    compiler(compositeObject, ...args) {
        compositeObject.compileComposite(...args);
    },

    findConflictualPropertyIndex(properties, possiblyConflictualProperty) {
        return properties.findIndex(function(property) {
            return property.isConflictingWith(possiblyConflictualProperty);
        });
    },

    handlePropertyCollision(compositeObject, property, conflictualProperty) {
        // here we could impvoe perf by finding the appropriat reaction and if the reaction
        // is to clone currentProperty we can do nothing because it's already there
        const reaction = property.reactWith(conflictualProperty, compositeObject);
        const importedProperty = reaction.produce();
        reaction.transform();
        reaction.refine();
        return importedProperty;
    },

    handleNewProperty(compositeObject, property, index) {
        const transformation = property.transform(compositeObject, index);
        const importedProperty = transformation.produce();
        transformation.transform();
        transformation.refine();
        return importedProperty;
    },

    addProperty(compositeObject, property) {
        compositeObject.appendChild(property);
    }
});
ObjectElement.refine({
    transformation: CloneTransformation,
    fillClone() {
        this.value = {};
    },

    reaction: CombineObjectReaction,
    fillComposite() {
        this.value = {};
    },
    compileComposite() {}
});
const ObjectPropertyElement = Element.extend('ObjectProperty', {
    effect() {
        const object = this.parentNode;
        if (object) {
            // console.log('define property', this.name, '=', this.descriptor, 'on', object.value);
            Object.defineProperty(object.value, this.name, this.descriptor);
        }
    },

    isConflictingWith(otherProperty) {
        return this.name === otherProperty.name;
    },

    fill(descriptor) {
        this.descriptor = descriptor;

        if (descriptor.hasOwnProperty('value')) {
            const propertyValue = descriptor.value;
            const valueNode = Lab.match(propertyValue);
            this.appendChild(valueNode);
            valueNode.fill(propertyValue);
        } else {
            if (descriptor.hasOwnProperty('get')) {
                const propertyGetter = descriptor.get;
                const getterNode = Lab.match(propertyGetter);
                this.appendChild(getterNode);
                getterNode.fill(propertyGetter);
            }
            if (descriptor.hasOwnProperty('set')) {
                const propertySetter = descriptor.set;
                const setterNode = Lab.match(propertySetter);
                this.appendChild(setterNode);
                setterNode.fill(propertySetter);
            }
        }
    },

    get name() {
        return this.value;
    },

    set name(name) {
        this.value = name;
    },

    get valueNode() {
        const descriptor = this.descriptor;
        return descriptor.hasOwnProperty('value') ? this.children[0] : null;
    },

    get getterNode() {
        const descriptor = this.descriptor;
        if (descriptor.hasOwnProperty('get')) {
            return this.children[0];
        }
        return null;
    },

    get setterNode() {
        const descriptor = this.descriptor;
        if (descriptor.hasOwnProperty('set')) {
            return this.children.length === 2 ? this.children[1] : this.children[0];
        }
        return null;
    },

    get propertyValue() {
        const valueNode = this.valueNode;
        return valueNode ? valueNode.value : undefined;
    },

    setValue(value) {
        this.valueNode.value = value;
        this.descriptor.value = value;
    },

    incrementValue() {
        this.setValue(this.valueNode.value + 1);
        // in case the descriptor is not configurable we may have an error here
        // but spec it works for length property because even if not configurable it's writable
        // a defineProperty will only update the value
        this.effect();
    },

    isIndex: (function() {
        const STRING = 0; // name is a string it cannot be an array index
        const INFINITE = 1; // name is casted to Infinity, NaN or -Infinity, it cannot be an array index
        const FLOATING = 2; // name is casted to a floating number, it cannot be an array index
        const NEGATIVE = 3; // name is casted to a negative integer, it cannot be an array index
        const TOO_BIG = 4; // name is casted to a integer above Math.pow(2, 32) - 1, it cannot be an array index
        const VALID = 5; // name is a valid array index
        const maxArrayIndexValue = Math.pow(2, 32) - 1;

        function getArrayIndexStatusForString(name) {
            if (isNaN(name)) {
                return STRING;
            }
            const number = Number(name);
            if (isFinite(number) === false) {
                return INFINITE;
            }
            if (Math.floor(number) !== number) {
                return FLOATING;
            }
            if (number < 0) {
                return NEGATIVE;
            }
            if (number > maxArrayIndexValue) {
                return TOO_BIG;
            }
            return VALID;
        }

        function isPropertyNameValidArrayIndex(propertyName) {
            return getArrayIndexStatusForString(propertyName) === VALID;
        }

        return function() {
            return isPropertyNameValidArrayIndex(this.name);
        };
    })()
});
const CombinePropertyReaction = Reaction.extend({
    maker(firstProperty, secondProperty) {
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

    packager(compositeProperty, firstComponent, secondComponent) {
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
            reaction.transform();
            reaction.refine();
        }
    },

    handleConstituantReaction(compositeProperty, firstConstituant, secondConstituant) {
        return firstConstituant.reactWith(secondConstituant, compositeProperty);
    }
});
Element.refine({
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
});
const SafeCombineProperty = createDynamicReaction(
    function(firstProperty, secondProperty, compositeObject) {
        if (firstProperty.descriptor.configurable === false && firstProperty.parentNode === compositeObject) {
            // this case happens with array length property
            // or function name property, in that case we preserve the current property of the compositeObject
            // console.log('own property is not configurable, cannot make it react');
            return true;
        }
        return false;
    },
    CancelReaction,
    CombinePropertyReaction
);
ObjectPropertyElement.refine({
    fillCopy(property) {
        this.value = property.value;
        this.descriptor = property.descriptor;
    },

    transformation: CloneTransformation,
    fillClone(property) {
        this.value = property.value;
        this.descriptor = Object.assign({}, property.descriptor);
    },
    reaction: SafeCombineProperty
});

const ArrayElement = ObjectElement.extend('Array', createConstructedByProperties(Array), {
    fillClone() {
        this.value = [];
    },

    fillComposite() {
        this.value = [];
    },

    createProperty(name) {
        return ArrayPropertyElement.create(name);
    },

    getPropertyTrackingEntries() {
        return this.getProperty('length');
    }
});
ObjectElement.refine({
    getPropertyTrackingEntries() {
        let trackingProperty;
        const lengthProperty = this.getProperty('length');
        if (lengthProperty) {
            const value = lengthProperty.propertyValue;
            if (typeof value === 'number') {
                trackingProperty = lengthProperty;
            } else {
                trackingProperty = null;
            }
        } else {
            trackingProperty = null;
        }
        return trackingProperty;
    }
});
const ArrayPropertyElement = ObjectPropertyElement.extend('ArrayProperty');
ArrayPropertyElement.refine({
    isConflictingWith(otherProperty) {
        const propertyHaveSameName = this.name === otherProperty.name;

        // ignore conflict when two indexed property wants to be concatened
        if (propertyHaveSameName && this.isIndex()) {
            // console.log('ignoring conflict for', this.name, 'because it will be concatened');
            return false;
        }
        return propertyHaveSameName;
    },

    effect() {
        const parentNode = this.parentNode;
        if (parentNode && this.isIndex()) {
            const propertyTrackingEntries = parentNode.getPropertyTrackingEntries();
            if (propertyTrackingEntries) {
                propertyTrackingEntries.incrementValue();
            }
        }
        return ObjectPropertyElement.effect.apply(this, arguments);
    },

    transformation: createDynamicTransformation(
        function(arrayProperty, array, compositionIndex) {
            // we concat only the second array indexed properties
            return arrayProperty.isIndex() && compositionIndex > 0;
        },
        // ArrayPropertyConcatTransformation
        // currently we have "hardcoded" that concatened properties must be cloned
        // (because ArrayConcatTransformation extends CloneTransformation)
        // they may be copied instead (by extending CopyTransformation)
        // but I'm not sure what is the right choice here. I suppose concatenation does not mean we must clone stuff
        // so let's us copy for now but keep in mind we may want to copy as well
        CopyTransformation.extend({
            maker(arrayProperty, parentElement) {
                const product = CopyTransformation.maker.apply(this, arguments);

                // parentElement can be :
                // - an object when you compose object + array and it becomes an array like after composition
                // - an arraylike when you composed object + array or that the object was already an array like
                // - an array when you compose array + array
                // as a consequence we check if parentELement has a property trackingEntries we can use to concat
                // when we copy a copied array which was frozen we got a prob

                // we must concat not using parentElement because its the subject of the concatenation
                // we must use parentElement component
                const propertyTrackingEntries = parentElement.firstComponent.getPropertyTrackingEntries();

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

                    // now we copy the property
                    product.name = concatenedIndexAsString;
                    // console.log(copy.descriptor.value, 'index updated to', concatenedIndex, 'from', conflictualIndex);
                }

                return product;
            },

            createNestedCopy(...args) {
                return NoTransformation.create(...args);
            }
        }),
        CloneTransformation
    ),
    reaction: createDynamicReaction(
        function(firstArrayProperty, secondArrayProperty, parentELement) {
            // when there is a length property and parentElement has no length property
            // then we set a length property at zero on the arraylike result
            return firstArrayProperty.name === 'length' && !parentELement.getPropertyTrackingEntries();
        },
        CombinePropertyReaction.extend({
            handleConstituantReaction(compositeLength, firstLength) {
                // on doit s'assurer soit que length est la dernière propriété que l'on met
                // soit que incrementValue met à jour length avec effect()
                // parce qu'on est pas sur que la valeur finale de length
                // soit bien firstLength + secondLength
                // il suffit qu'une des entrées du tableau ne souhaite pas être concat pour tout niquer
                const resetCompositeLengthTransformation = CloneTransformation.create(firstLength, compositeLength);
                resetCompositeLengthTransformation.refine = function(compositeLengthCopy, compositeLength) {
                    const resetValueTransformation = CloneTransformation.create(
                        compositeLength.valueNode,
                        compositeLengthCopy
                    );
                    resetValueTransformation.produce = function(length) {
                        const lengthCopy = length.copy();
                        lengthCopy.value = 0;
                        return lengthCopy;
                    };
                    return resetValueTransformation;
                };
                return resetCompositeLengthTransformation;
            }
        }),
        function(firstArrayProperty) {
            // we disable reaction concerning the length property as it would mutate the array
            // instead we manually increase the length property when indexed property are added
            // because length property is non configurable by default this check is not mandatory
            // as length would be ignored by SafeCombineProperty
            // but this is "luck" so don't rely on luck, be explicit
            // if tomorrow JS engine decide length property is configurable this will still work
            return firstArrayProperty.name === 'length';
        },
        CancelReaction,
        SafeCombineProperty
    )
});

const BooleanElement = ObjectElement.extend('Boolean', createConstructedByProperties(Boolean));
const NumberElement = ObjectElement.extend('Number', createConstructedByProperties(Number));
const StringElement = ObjectElement.extend('String', createConstructedByProperties(String));
const RegExpElement = ObjectElement.extend('RegExp', createConstructedByProperties(RegExp));
const DateElement = ObjectElement.extend('Date', createConstructedByProperties(Date));
// handle function as primitive because perf
const FunctionElement = ObjectElement.extend('Function',
    createConstructedByProperties(Function),
    PrimitiveProperties,
    {
        listProperties(value) {
            return Object.getOwnPropertyNames(value).filter(function(name) {
                // do as if prototype property does not exists for now
                // because every function.prototype is a circular structure
                // due to prototype.constructor
                return name !== 'prototype';
            });
        }
    }
);
// handle error as primitive because hard to preserve stack property
const ErrorElement = ObjectElement.extend('Error',
    createConstructedByProperties(Error),
    PrimitiveProperties
);
// to add : MapElement, MapEntryElement, SetElement, SetEntryElement

export {
    ObjectElement,
    ObjectPropertyElement,
    BooleanElement,
    NumberElement,
    StringElement,
    ArrayElement,
    ArrayPropertyElement,
    FunctionElement,
    ErrorElement,
    RegExpElement,
    DateElement
};
