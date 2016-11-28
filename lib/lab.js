/* eslint-disable no-use-before-define */

// https://github.com/Yomguithereal/baobab
import util from './util.js';
import Node from './node.js';

const Lab = util.extend({
    scan(value) {
        const element = this.match(value);
        element.fill(value);
        return element;
    },

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

const scan = Lab.scan.bind(Lab);

const Element = Node.extend({
    match() {
        return false;
    },

    extend(tagName, ...args) {
        const Element = util.extend.apply(this, args);
        Element.tagName = tagName;
        Lab.register(Element, this);
        return Element;
    }
});

Element.refine({
    reactWith(secondElement, parentNode) {
        const firstElement = this.asElement();
        if (Element.isPrototypeOf(secondElement) === false) {
            secondElement = scan(secondElement);
        }
        let reaction = firstElement.reaction;

        return reaction.create(firstElement, secondElement, parentNode);
    },

    transform(parentNode, index) {
        const transformation = this.transformation.create(this, parentNode, index);
        return transformation;
    },

    asElement() {
        // pointerNode will return the pointedElement
        // doing ctrl+c & ctrl+v on a symlink on windows copy the symlinked file and not the symlink
        return this;
    },

    effect() {}
});

Element.refine({
    compose() {
        let composite;
        if (arguments.length === 0) {
            let transformation = this.transform();
            let product = transformation.prepare();
            transformation.proceed();
            composite = product;
        } else {
            let i = 0;
            let j = arguments.length;
            composite = this;
            for (;i < j; i++) {
                let reaction = composite.reactWith(arguments[i]);
                let product = reaction.prepare();
                reaction.proceed();
                composite = product;
            }
        }

        return composite;
    }
});

export {
    Element,
    Lab,
    scan
};
export default Lab;
