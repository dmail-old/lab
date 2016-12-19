/* eslint-disable no-use-before-define */

import util from './util.js';
import polymorph from './polymorph.js';
import Node from './node.js';

const defaultOptions = {
    functionBehaviour: 'primitive',
    bindMethod: false,
    bindMethodImplementation: 'absolute',
    concatArray: true,
    concatArrayLike: true,
    syncArrayLikeLength: true
};

function createComposer(customOptions = {}) {
    const options = Object.assign({}, defaultOptions, customOptions);

    const Lab = util.extend({
        match(value) {
            const ElementMatchingValue = this.findElementByValueMatch(value);
            const element = ElementMatchingValue.create(value);
            return element;
        },

        findElementByValueMatch(value) {
            if (arguments.length === 0) {
                throw new Error('Lab.findElementByValueMatch expect one arguments');
            }
            let ElementMatchingValue = this.Elements.find(function(Element) {
                return Element.match(value);
            });
            if (!ElementMatchingValue) {
                throw new Error('no registered element matches value ' + value);
            }
            return ElementMatchingValue;
        },
        Elements: [],

        compareSpecificity(elementA, elementB) {
            const elementAPrototype = Object.getPrototypeOf(elementA);
            const elementBPrototype = Object.getPrototypeOf(elementB);

            if (elementAPrototype === elementBPrototype) {
                return 0;
            }

            for (let Element of this.Elements) {
                // elementAPrototype comes first, it's more sepcific
                if (Element === elementAPrototype) {
                    return 1;
                }
                // elementB comes first it's more specific
                if (Element === elementBPrototype) {
                    return -1;
                }
            }
            throw new Error('cannot compare specificity of unknow element');
        },

        // createElement(tagName, value) {
        //     const ElementMatchingName = this.findElementByTagName(tagName);
        //     const element = ElementMatchingName.create(value);
        //     return element;
        // },

        findElementByTagName(tagName) {
            if (arguments.length === 0) {
                throw new Error('Lab.findElementByName expect one arguments');
            }
            let ElementUsingTagName = this.Elements.find(function(Element) {
                return Element.tagName === tagName;
            });
            if (!ElementUsingTagName) {
                throw new Error('no registered element using tagName ' + tagName);
            }
            return ElementUsingTagName;
        },

        register(Element, ExtendedElement) {
            let ExtendedElementIndex;

            if (ExtendedElement) {
                ExtendedElementIndex = this.Elements.indexOf(ExtendedElement);
            } else {
                ExtendedElementIndex = -1;
            }

            if (ExtendedElementIndex === -1) {
                this.Elements.push(Element);
            } else {
                this.Elements.splice(ExtendedElementIndex, 0, Element);
            }
        }
    });

    const Element = Node.extend({
        extend(tagName, ...args) {
            const Element = util.extend.apply(this, args);
            Element.tagName = tagName;
            Lab.register(Element, this);
            return Element;
        },

        get path() {
            const paths = [];
            if (this.name) {
                paths.unshift(this.name);
                for (let parentNode of this.createAncestorIterable()) {
                    if (parentNode.name) {
                        paths.unshift(parentNode.name);
                    }
                }
            }
            return '#' + paths.join('.');
        },

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

    /* ------------------------ PRIMITIVES ------------------------ */
    const PrimitiveProperties = {
        primitiveMark: true
    };
    const NullPrimitiveElement = Element.extend('null', PrimitiveProperties);
    const UndefinedPrimitiveElement = Element.extend('undefined', PrimitiveProperties);
    const BooleanPrimitiveElement = Element.extend('boolean', PrimitiveProperties);
    const NumberPrimitiveElement = Element.extend('number', PrimitiveProperties);
    const StringPrimitiveElement = Element.extend('string', PrimitiveProperties);
    const SymbolPrimitiveElement = Element.extend('symbol', PrimitiveProperties);

    /* ------------------------ COMPOSITES ------------------------ */
    // must be registered before ObjectElement because it must match before (during Lab.match)
    const PropertyElement = Element.extend('Property', {
        can(what) {
            const lastChar = what[what.length - 1];
            let abilityName;
            if (lastChar === 'a' || lastChar === 'e') {
                abilityName = what.slice(0, -1) + 'able';
            } else {
                abilityName = what + 'able';
            }

            return this.getChildByName(abilityName) !== false;
        },

        getChildByName(name) {
            return this.children.find(function(child) {
                return child.name === name;
            });
        },

        canConfigure() {
            return this.can('configure');
        },

        canEnumer() {
            return this.can('enumer');
        },

        canWrite() {
            return this.can('write');
        },

        get data() {
            return this.getChildByName('value');
        },

        get getter() {
            return this.getChildByName('getter');
        },

        get setter() {
            return this.getChildByName('setter');
        },

        isData() {
            return Boolean(this.getChildByName('writable'));
        },

        isAccessor() {
            // seul la présent de get ou set garantie qu'on a bien un accessor
            // parce que il existe un moment où propertyElement n'a pas encore
            // d'enfant et donc n'est ni data ni accessor
            // ça pose sûrement souci dailleurs lors de la transformation
            // puisque du coup includeChild va retourner true tant qu'on ne sait pas quel type
            // de propriété on souhait obtenir à la fin
            return Boolean(this.getChildByName('get') || this.getChildByName('set'));
        },

        install(element) {
            const descriptor = this.createDescriptor();
            // console.log('set', this.name, '=', descriptor, 'on', element.value);
            Object.defineProperty(element.value, this.name, descriptor);
        },

        createDescriptor() {
            const descriptor = {};
            this.children.forEach(function(child) {
                descriptor[child.name] = child.value;
            });
            return descriptor;
        },

        uninstall(element) {
            // console.log('delete', this.name, 'on', element.value);
            delete element.value[this.name];
        }
    });
    function createConstructedByProperties(Constructor) {
        return {
            valueConstructor: Constructor
        };
    }
    const ObjectElement = Element.extend('Object', createConstructedByProperties(Object), {
        hasProperty(name) {
            return this.children.some(function(child) {
                return PropertyElement.isPrototypeOf(child) && child.name === name;
            });
        },

        getProperty(name) {
            return this.children.find(function(child) {
                return PropertyElement.isPrototypeOf(child) && child.name === name;
            });
        }
    });
    const ArrayElement = ObjectElement.extend('Array', createConstructedByProperties(Array));
    const BooleanElement = ObjectElement.extend('Boolean', createConstructedByProperties(Boolean));
    const NumberElement = ObjectElement.extend('Number', createConstructedByProperties(Number));
    const StringElement = ObjectElement.extend('String', createConstructedByProperties(String));
    const RegExpElement = ObjectElement.extend('RegExp', createConstructedByProperties(RegExp));
    const DateElement = ObjectElement.extend('Date', createConstructedByProperties(Date));
    const FunctionElement = ObjectElement.extend('Function', createConstructedByProperties(Function));
    const ErrorElement = ObjectElement.extend('Error', createConstructedByProperties(Error));
    // to add : MapElement, MapEntryElement, SetElement, SetEntryElement

    /* ----------------------------- TRANSFORMATION ------------------------- */
    const PropertyDefinition = util.extend({
        constructor(name, descriptor) {
            this.name = name;
            if (descriptor) {
                this.descriptor = descriptor;
            }
        },
        descriptor: {}
    });

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

    const scanValue = polymorph();
    const scanProduct = function(value, name) {
        if (Element.isPrototypeOf(value)) {
            console.warn('scanning an element is not supposed to happen for now');
            return value;
        }

        let primitiveValue;
        if (value === null || value === undefined) {
            primitiveValue = value;
        } else {
            primitiveValue = value.valueOf();
        }

        const product = Lab.findElementByValueMatch(primitiveValue).create();
        product.value = primitiveValue;

        if (arguments.length > 1) {
            if (PropertyDefinition.isPrototypeOf(primitiveValue)) {
                product.name = primitiveValue.name;
            } else {
                product.name = name;
            }
        }

        return product;
    };
    function scanProperties(propertyNames, element) {
        const value = element.value;
        for (let name of propertyNames) {
            const descriptor = Object.getOwnPropertyDescriptor(value, name);
            const definition = PropertyDefinition.create(name, descriptor);
            const property = scanProduct(definition, name);
            element.appendChild(property);
            property.scanValue();
        }
    }
    scanValue.branch(
        ObjectElement.asMatcher(),
        function() {
            scanProperties(Object.getOwnPropertyNames(this.value), this);
        }
    );
    scanValue.branch(
        PropertyElement.asMatcher(),
        function() {
            const value = this.value;
            const descriptor = value.descriptor;
            Object.keys(descriptor).forEach(function(key) {
                const descriptorPropertyValue = descriptor[key];
                const descriptorProperty = scanProduct(descriptorPropertyValue, key);
                this.appendChild(descriptorProperty);
                descriptorProperty.scanValue();
            }, this);
        }
    );
    // disable function.prototype.constructor property discoverability to prevent infinite recursion
    // it's because prototype is a cyclic structure due to circular reference between prototype/constructor
    scanValue.preferBranch(
        function() {
            const parentNode = this.parentNode;
            const ancestor = parentNode ? parentNode.parentNode : null;

            return (
                ObjectElement.isPrototypeOf(this) &&
                parentNode &&
                PropertyElement.isPrototypeOf(parentNode) &&
                parentNode.name === 'prototype' &&
                ancestor &&
                FunctionElement.isPrototypeOf(ancestor)
            );
        },
        function() {
            // when scanning a function prototype object omit the constructor property to prevent infinit recursion
            scanProperties(Object.getOwnPropertyNames(this.value).filter(function(name) {
                return name !== 'constructor';
            }), this);
        }
    );

    // include child
    (function() {
        Element.refine({
            includeChild() {
                // cela veut dire : une primitive ne peut pas avoir d'enfant
                return this.primitiveMark !== true;
            }
        });
        PropertyElement.refine({
            includeChild(child) {
                if (this.isData()) {
                    // data property ignores getter & setter
                    let include = (
                        child.name === 'configurable' ||
                        child.name === 'enumerable' ||
                        child.name === 'writable' ||
                        child.name === 'value'
                    );
                    // console.log('data property include', include);
                    return include;
                }
                if (this.isAccessor()) {
                    // accessor property ignores writable & values
                    let include = (
                        child.name === 'configurable' ||
                        child.name === 'enumerable' ||
                        child.name === 'get' ||
                        child.name === 'set'
                    );
                    // console.log('accessor property include', include);
                    return include;
                }
                return true;
            }
        });
    })();

    const variation = polymorph();
    const conflictsWith = polymorph();

    const combineChildren = (function() {
        const debug = !true;

        function combineChildrenOneSource(sourceElement, destinationElement) {
            const filteredSourceElementChildren = filterChildren(sourceElement, destinationElement);
            const unConflictualSourceElementChildren = collideChildren(
                filteredSourceElementChildren,
                destinationElement
            );

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
            // 2 : met les enfants dont le conflit concerne first ou second avec existing et récupère ce qui reste
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
    Element.refine({
        mutate(value) {
            const product = scanProduct(value, this.name);
            this.replace(product);
            product.scanValue();
            product.variation('change', this);
            return product;
        }
    });

    const touchValue = polymorph();
    const TouchTransformation = Transformation.extend({
        parentNodeIndex: 1,

        make(elementModel, parentNode) {
            return elementModel.touchValue(parentNode);
        },

        transform(touchedValue, elementModel) {
            return scanProduct(touchedValue, elementModel.name);
        },

        fill(product, elementModel) {
            product.scanValue();
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
            let product = scanProduct(combinedValue, firstElement.name);
            product.firstComponent = firstElement;
            product.secondComponent = secondElement;
            return product;
        },

        fill(product, firstElement, secondElement) {
            product.scanValue();

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

        transform(instantiedValue, elementModel) {
            return scanProduct(instantiedValue, elementModel.name);
        },

        fill(product, elementModel) {
            product.scanValue();

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
    // quand un élément de la description d'une propriété change, réinstalle la sur son objet
    // amélioration : pas besoin de faire ça sur la valeur de la propriété length dans un tableau (javascript le fait auto)
    variation.when(
        function(type) {
            const parentNode = this.parentNode;

            return (
                type === 'change' &&
                PropertyElement.isPrototypeOf(parentNode) &&
                parentNode.parentNode &&
                ObjectElement.isPrototypeOf(parentNode.parentNode)
            );
        },
        function() {
            this.parentNode.install(this.parentNode.parentNode);
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
            const value = this.value;
            const prototype = Object.getPrototypeOf(value);
            // handle case where object are not directly linked to Object.prototype
            return Object.create(prototype);
        }
    );
    // Array
    touchValue.branch(
        ArrayElement.asMatcher(),
        function() {
            return [];
        }
    );
    // Boolean, Number, String, RegExp, Date, Error
    touchValue.branch(
        function() {
            return (
                ObjectElement.isPrototypeOf(this) &&
                this.hasOwnProperty('valueConstructor')
            );
        },
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
            return PropertyDefinition.create(this.value.name);
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
    // property use otherProperty touched value (inherits name) (must no inherits descriptor however)
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
    function instanceOrConstructorReturnValue(instance, returnValue) {
        if (returnValue === null) {
            return instance;
        }
        if (typeof returnValue === 'object') {
            return returnValue;
        }
        return instance;
    }
    combineValue.branch(
        function(otherElement, parentNode) {
            return (
                FunctionElement.isPrototypeOf(this) &&
                FunctionElement.isPrototypeOf(otherElement) &&
                this.name === 'value' &&
                PropertyElement.isPrototypeOf(parentNode) &&
                parentNode.name === 'constructor'
            );
        },
        function(otherConstructor) {
            const firstConstructor = this.value;
            const secondConstructor = otherConstructor.value;
            return function combinedConstructor() {
                let instance = this;
                const firstConstructorReturnValue = firstConstructor.apply(instance, arguments);
                instance = instanceOrConstructorReturnValue(instance, firstConstructorReturnValue);
                const secondConstructorReturnValue = secondConstructor.apply(instance, arguments);
                instance = instanceOrConstructorReturnValue(instance, secondConstructorReturnValue);
                return instance;
            };
        }
    );
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
            // console.log('Object.create at', this.path);
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
            // console.log('delegate', this.path);
            throw CancelTransformation;
        }
    );
    instantiateValue.branch(
        PropertyElement.asMatcher(),
        function(parentNode) {
            // console.log('instantiate property at', this.path);
            return this.touchValue(parentNode);
        }
    );
    // all non delegated stuff must be instantiated
    instantiateValue.branch(
        function() {
            return true;
        },
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

    /* ---------------- natively unconfigurable properties -------------- */
    (function() {
        const debug = !true;

        // selon le moteur javaScript certaines propriétés sont à configurable: false
        // lorsque l'objet est créé
        // on peut noter principalement Array.prototype.length, Function.prototype.length, Function.prototype.name
        // mais il y en a potentiellement d'autres
        // toutes ces propriétées ne peuvent être redéfinies et restent donc sur l'objet

        function isConfigurable(object, property) {
            const propertyDescriptor = Object.getOwnPropertyDescriptor(object, property);
            return propertyDescriptor.configurable === true;
        }
        function cancelTransformation() {
            if (debug) {
                console.warn('cancel transformation of', this.name, 'property (natively not configurable)');
            }
            throw CancelTransformation;
        }

        [
            ObjectElement,
            ArrayElement,
            BooleanElement,
            NumberElement,
            StringElement,
            RegExpElement,
            DateElement,
            FunctionElement,
            ErrorElement
        ].forEach(function(CompositeElement) {
            const testValue = new CompositeElement.valueConstructor(); // eslint-disable-line new-cap

            Object.getOwnPropertyNames(testValue).forEach(function(name) {
                if (isConfigurable(testValue, name) === false) {
                    if (debug) {
                        console.warn(name, 'property is natively not configurable on', CompositeElement.tagName);
                    }

                    const isUnconfigurableProperty = function(element) {
                        return (
                            PropertyElement.isPrototypeOf(element) &&
                            element.name === name &&
                            element.parentNode &&
                            CompositeElement.isPrototypeOf(element.parentNode)
                        );
                    };

                    combineValue.preferBranch(
                        function() {
                            return isUnconfigurableProperty(this);
                        },
                        cancelTransformation
                    );
                    touchValue.preferBranch(
                        function(parentNode) {
                            return (
                                (
                                    this.parentNode === parentNode || (
                                        parentNode &&
                                        CompositeElement.isPrototypeOf(parentNode) &&
                                        parentNode.hasProperty(name)
                                    )
                                ) &&
                                isUnconfigurableProperty(this)
                            );
                        },
                        cancelTransformation
                    );
                }
            });
        });
    })();

    /* ---------------- function behaviour -------------- */
    (function() {
        if (options.functionBehaviour === 'primitive') {
            touchValue.branch(
                FunctionElement.asMatcher(),
                function() {
                    return this.value;
                }
            );

            FunctionElement.refine({
                includeChild() {
                    return false;
                }
            });
        } else if (options.functionBehaviour === 'composite') {
            const originalFunctionSymbol = Symbol();

            if (options.bindMethodImplementation === 'relative') {
                // https://gist.github.com/dmail/a593f694dfccb2a87bf926382cac998f
                const prototypeApply = Function.prototype.apply;
                const prototypeCall = Function.prototype.call;
                prototypeApply.apply = prototypeApply;
                prototypeCall.apply = prototypeApply;

                Function.prototype.apply = function applyHook() { // eslint-disable-line no-extend-native
                    const fn = originalFunctionSymbol in this ? this[originalFunctionSymbol] : this;
                    return prototypeApply.apply(fn, arguments);
                };
                Function.prototype.call = function callHook() { // eslint-disable-line no-extend-native
                    const fn = originalFunctionSymbol in this ? this[originalFunctionSymbol] : this;
                    return prototypeCall.apply(fn, arguments);
                };
            }

            // https://gist.github.com/dmail/6e639ac50cec8074a346c9e10e76fa65
            const cloneFunction = function cloneFunction(fn, bind) {
                let wrapperConstructorProxy;
                const hasBinding = arguments.length > 1;
                const wrapper = function() {
                    let result;
                    if (this instanceof wrapper) {
                        // some native constructor must absolutely be called using new (Array for instance)
                        // se we can't use Object.create but we need to be able to pass arbitrary number of arguments
                        // http://stackoverflow.com/questions/1606797/use-of-apply-with-new-operator-is-this-possible
                        if (wrapperConstructorProxy === undefined) {
                            wrapperConstructorProxy = function(args) {
                                return fn.apply(this, args);
                            };
                            wrapperConstructorProxy.prototype = fn.prototype;
                        }
                        result = new wrapperConstructorProxy(arguments); // eslint-disable-line new-cap
                    } else if (hasBinding) {
                        result = fn.apply(bind, arguments);
                    } else {
                        result = fn.apply(this, arguments);
                    }

                    return result;
                };
                wrapper[originalFunctionSymbol] = fn;
                // au lieu du symbol ça pourrais marcher aussi
                // wrapper.valueOf = function() {
                //     return fn;
                // };

                return wrapper;
            };

            touchValue.branch(
                FunctionElement.asMatcher(),
                function(parentNode) {
                    const fn = this.value;
                    let clone;

                    if (options.bindMethod && parentNode) {
                        const ancestor = parentNode.parentNode;
                        if (ancestor && ObjectElement.isPrototypeOf(ancestor)) {
                            if (options.bindMethodImplementation === 'absolute') {
                                clone = fn.bind(ancestor.value);
                            } else if (options.bindMethodImplementation === 'relative') {
                                clone = cloneFunction(fn, ancestor.value);
                            }
                        } else {
                            clone = cloneFunction(fn);
                        }
                    } else {
                        clone = cloneFunction(fn);
                    }

                    return clone;
                }
            );
        }
    })();

    /* ---------------- countTracker ---------------- */
    (function() {
        const debug = false;
        const STRING = 0; // name is a string it cannot be an array index
        const INFINITE = 1; // name is casted to Infinity, NaN or -Infinity, it cannot be an array index
        const FLOATING = 2; // name is casted to a floating number, it cannot be an array index
        const NEGATIVE = 3; // name is casted to a negative integer, it cannot be an array index
        const TOO_BIG = 4; // name is casted to a integer above Math.pow(2, 32) - 1, it cannot be an array index
        const VALID = 5; // name is a valid array index
        const maxArrayLength = Math.pow(2, 32) - 1;
        const maxArrayIndex = maxArrayLength - 1;
        function getArrayIndexStatusForString(name) {
            if (isNaN(name)) {
                return STRING;
            }
            return getArrayIndexStatusForNumber(Number(name));
        }
        function getArrayIndexStatusForNumber(number) {
            let status = getNumberStatus(number);
            if (status === undefined) {
                if (number > maxArrayIndex) {
                    status = TOO_BIG;
                } else {
                    status = VALID;
                }
            }
            return status;
        }
        function getNumberStatus(number) {
            let status;
            if (isFinite(number) === false) {
                status = INFINITE;
            } else if (Math.floor(number) !== number) {
                status = FLOATING;
            } else if (number < 0) {
                status = NEGATIVE;
            }
            return status;
        }
        function getArrayLengthStatusForNumber(number) {
            let status = getNumberStatus(number);
            if (status === undefined) {
                if (number > maxArrayLength) {
                    status = TOO_BIG;
                } else {
                    status = VALID;
                }
            }
            return status;
        }

        const countTrackerPropertyName = 'length';
        Element.refine({
            isCountTrackerValue() {
                return (
                    this.tagName === 'number' &&
                    getArrayLengthStatusForNumber(this.value) === VALID
                );
            },

            isIndexedProperty() {
                return (
                    PropertyElement.isPrototypeOf(this) &&
                    getArrayIndexStatusForString(this.name) === VALID
                );
            },

            isCountTrackerProperty() {
                return (
                    PropertyElement.isPrototypeOf(this) &&
                    this.name === countTrackerPropertyName &&
                    this.isData() &&
                    this.data.isCountTrackerValue()
                );
            },

            getCountTrackerProperty() {
                if (ObjectElement.isPrototypeOf(this)) {
                    return this.getProperty(countTrackerPropertyName);
                }
                return null;
            },

            hasCountTrackerProperty() {
                const countTrackerProperty = this.getCountTrackerProperty();
                return (
                    countTrackerProperty &&
                    countTrackerProperty.isData() &&
                    countTrackerProperty.data.isCountTrackerValue()
                );
            }
        });

        // when an indexed property is added/removed inside an Element having a property count tracker
        variation.when(
            function() {
                return (
                    this.isIndexedProperty() &&
                    this.parentNode &&
                    this.parentNode.hasCountTrackerProperty()
                );
            },
            function(type) {
                const countTrackerProperty = this.parentNode.getCountTrackerProperty();
                const countTracker = countTrackerProperty.data;

                if (type === 'added') {
                    if (debug) {
                        console.log('increment count tracker value');
                    }
                    countTracker.mutate(countTracker.value + 1);
                } else if (type === 'removed') {
                    if (debug) {
                        console.log('decrement count tracker value');
                    }
                    countTracker.mutate(countTracker.value - 1);
                }
            }
        );

        // length count tracker must be in sync with current amount of indexed properties
        // doit se produire pour touch, combine et instantiate mais pas scan
        // il faut couvrir tous ces cas
        // arraylike -> {length: 0}.compose() or instantiate()
        // array -> [].compose() or instantiate()
        // arraylike + object -> {length: 0}.compose({})
        // arraylike + arraylike -> {length: 0}.compose({length: 1})
        // arraylike + array -> {length: 1}.compose([])
        // array + array -> [].compose([])
        // array + arraylike -> [].compose({length: 1})
        // array + object -> [].compose({})

        function elementIsCountTrackerValue(element, destinationParentNode) {
            const parentNode = element.parentNode;
            const destinationAncestor = destinationParentNode ? destinationParentNode.parentNode : null;

            return (
                element.isCountTrackerValue() &&
                parentNode &&
                parentNode.isCountTrackerProperty() &&
                parentNode.data === element &&
                destinationParentNode &&
                destinationAncestor &&
                ObjectElement.isPrototypeOf(destinationAncestor)
            );
        }

        function getIndexedPropertyCount(element) {
            const indexedPropertyCount = element.children.reduce(function(previous, current) {
                if (current.isIndexedProperty()) {
                    previous++;
                }
                return previous;
            }, 0);
            if (debug) {
                console.log('override combined count tracker to', indexedPropertyCount);
            }
            return indexedPropertyCount;
        }

        [touchValue, instantiateValue].forEach(function(method) {
            method.preferBranch(
                function(destinationParentNode) {
                    return elementIsCountTrackerValue(this, destinationParentNode);
                },
                function(destinationParentNode) {
                    return getIndexedPropertyCount(destinationParentNode.parentNode);
                }
            );
        });
        combineValue.preferBranch(
            function(otherElement, destinationParentNode) {
                return elementIsCountTrackerValue(this, destinationParentNode);
            },
            function(otherElement, destinationParentNode) {
                return getIndexedPropertyCount(destinationParentNode.parentNode);
            }
        );
    })();

    /* ---------------- array concatenation ---------------- */
    (function() {
        const debug = !true;
        // ignore indexed property conflict when they will be concatened
        conflictsWith.preferBranch(
            function(otherProperty) {
                return (
                    this.name === otherProperty.name &&
                    this.isIndexedProperty() &&
                    this.parentNode &&
                    this.parentNode.hasCountTrackerProperty()
                );
            },
            function(otherProperty) {
                if (debug) {
                    console.log(
                        'ignoring conflict at', this.path, 'because', otherProperty.data.value, 'will be concatened'
                    );
                }
                return false;
            }
        );
        // concatened indexed property name must be modified when touched
        touchValue.preferBranch(
            function(parentNode) {
                return (
                    this.isIndexedProperty() &&
                    parentNode &&
                    parentNode.hasCountTrackerProperty()
                );
            },
            function(parentNode) {
                let index = this.value.name;
                const countTrackerProperty = parentNode.getCountTrackerProperty();
                const countTrackerData = countTrackerProperty.data;
                const countTrackerValue = countTrackerData.value;

                if (debug) {
                    console.log(
                        'concat', this.data.value,
                        'inside', parentNode.value, parentNode.value.length, countTrackerValue
                    );
                }

                if (countTrackerValue > 0) {
                    const currentIndex = Number(index);
                    const concatenedIndex = countTrackerValue;
                    // currentIndex + countTrackerValue;
                    index = String(concatenedIndex);
                    if (debug) {
                        console.log('index updated from', currentIndex, 'to', concatenedIndex);
                    }
                }

                return PropertyDefinition.create(index);
            }
        );
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
            const instantiatedComposite = this.instantiate().produce();
            const instantiatedValue = instantiatedComposite.value;

            if (ObjectElement.isPrototypeOf(this)) {
                const constructorProperty = this.getProperty('constructor');

                if (constructorProperty) {
                    constructorProperty.data.value.apply(instantiatedValue, arguments);
                }
            }

            return instantiatedValue;
        }
    };

    Element.refine(transformProperties);
    Element.refine({
        asElement() {
            // pointerNode will return the pointedElement
            // doing ctrl+c & ctrl+v on a symlink on windows copy the symlinked file and not the symlink
            return this;
        }
    });

    const scan = function(value) {
        const product = scanProduct(value);
        product.scanValue();
        return product;
    };

    Element.refine({
        valueOf() {
            return this.value;
        },

        compose() {
            let composite;
            if (arguments.length === 0) {
                let transformation = this.touch();
                let product = transformation.produce();
                composite = product;
            } else {
                let i = 0;
                let j = arguments.length;
                composite = this;
                for (;i < j; i++) {
                    const arg = arguments[i];
                    let element;
                    if (Element.isPrototypeOf(arg)) {
                        element = arg;
                    } else {
                        element = scan(arg);
                    }
                    let transformation = composite.combine(element);
                    let product = transformation.produce();
                    composite = product;
                }
            }

            return composite;
        }
    });

    // est ce qu'on peut partir du principe que le premier appel à compose fait un scan ?
    // si scan est appelé sans valeur alors on retourne pureElement
    const pureElement = Element.create();
    const compose = function() {
        return pureElement.compose.apply(pureElement, arguments);
    };
    compose.scan = scan;

    return compose;
}
export default createComposer;
export {createComposer as composer};

const defaultComposer = createComposer();

export {defaultComposer as compose};
