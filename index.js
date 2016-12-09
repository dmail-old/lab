/*
raf

- que tous les anciens tests passent avec polymorph
- modifier la doc concernant l'infection, il n'y aura pas d'infection juste un moyen de créer un custom composer
avec des options pour modifier le comportement existant
import {compose, composer} from '@dmail/lab';

compose; // c'est le composer par défaut pas besoin de faire compose = composer()
composer; // permet de créer une fonction compose custom qui se comporte d'une manière différente de celle par défaut
myCompose = composer({constructBindMethod: true, bindUsing: 'native'});

- en complément de cette manière de créer un custom composer y'aura un moyen d'jaouter du comportement custom
qui peut aussi se brancher sur les options passé lorsque l'on crée le custom composer
je ne sais pas encore quelle forme cette api là va prendre

ptet kk chose comme
import {composition} from '@dmail/lab';

composition.construct.branch(); // et hop on ajoute un cas custom
// il manque juste le moyen de dire cette branche s'active selon telle ou telle option

- une fois qu'on a tout ça on pousuis l'implémentation des examples
*/

import {Lab, Element} from './src/lab.js';
import util from './src/util.js';
import {
    NullPrimitiveElement,
    UndefinedPrimitiveElement,
    BooleanPrimitiveElement,
    NumberPrimitiveElement,
    StringPrimitiveElement,
    SymbolPrimitiveElement
} from './src/primitive.js';
import {
    ObjectElement,
    PropertyElement,
    DataPropertyElement,
    AccessorPropertyElement,
    BooleanElement,
    NumberElement,
    StringElement,
    ArrayElement,
    FunctionElement,
    ErrorElement,
    RegExpElement,
    DateElement
} from './src/composite.js';
import {polymorph} from './src/polymorph.js';

import defaultMalady from './src/maladies/default.js';

Element.refine(defaultMalady);
Element.refine({
    asElement() {
        // pointerNode will return the pointedElement
        // doing ctrl+c & ctrl+v on a symlink on windows copy the symlinked file and not the symlink
        return this;
    }
});

const PropertyDefinition = util.extend({
    constructor(name, descriptor) {
        this.name = name;
        this.descriptor = descriptor;
    }
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
    DataPropertyElement.refine({
        match(value) {
            return (
                PropertyDefinition.isPrototypeOf(value) &&
                value.descriptor.hasOwnProperty('value')
            );
        }
    });
    AccessorPropertyElement.refine({
        match(value) {
            return (
                PropertyDefinition.isPrototypeOf(value) &&
                value.descriptor.hasOwnProperty('value') === false
            );
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

const scan = function(value, parentNode) {
    const element = Lab.findElementByValueMatch(value).create();
    element.valueModel = value; // we need to remind valueModel if we want cyclic structure support
    // we could enable this only when valueModel & value !=
    element.value = element.scanValue(value);
    if (parentNode) {
        parentNode.appendChild(element);
    }
    element.scanChildren(value);
    element.variation('added');
    return element;
};
const scanValue = polymorph();
scanValue.branch(
    ObjectElement.asMatcherStrict(),
    function() {
        // on pourrait écrire return new arguments[0].constructor();
        return {};
    }
);
scanValue.branch(
    PropertyElement.asMatcher(),
    function(definition) {
        return definition.name;
    }
);
scanValue.branch(
    function() {
        return this.primitiveMark;
    },
    function(value) {
        return value;
    }
);
const scanChildren = polymorph();
scanChildren.branch(
    ObjectElement.asMatcher(),
    function(value) {
        Object.getOwnPropertyNames(value).forEach(function(name) {
            const descriptor = Object.getOwnPropertyDescriptor(value, name);
            const definition = PropertyDefinition.create(name, descriptor);
            scan(definition, this);
        }, this);
    }
);
scanChildren.branch(
    PropertyElement.asMatcher(),
    function(definition) {
        const descriptor = definition.descriptor;
        Object.keys(descriptor).forEach(function(key) {
            const propertyChild = scan(descriptor[key], this);
            // pour le moment on set le nom sur propertyCHild
            // c'est pas optimal parce que l'enfant n'a pas à savoir
            // cela et ca rend un peu confus avec les propriété qui on aussi une propriété name
            // idéalement les enfant d'une propriété devrait être stocké dans
            // une map genre {writable: writableNode} et manipulé comme une liste là ou c'est nécéssaire
            propertyChild.descriptorName = key;
        }, this);
    }
);
// disable prototype property disocverability on function to prevent infinite recursion (prototype is a cyclic structure)
// FunctionElement.refine({
//     scanChildren(value) {
//             return Object.getOwnPropertyNames(value).filter(function(name) {
//                 // do as if prototype property does not exists for now
//                 // because every function.prototype is a circular structure
//                 // due to prototype.constructor
//                 return name !== 'prototype';
//             });
//         }
//     }
// });
Element.refine({
    scanValue: scanValue,
    scanChildren: scanChildren
});

Element.refine({
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
const pureElement = Element.create();
const compose = pureElement.compose.bind(pureElement);

export {compose};

/*
amélioration de unit test afin d'éviter le problème que lorsqu'on comment un module
on a eslint qui dit cette variable n'est pas utilisé blah blah

exports const test = {
    modules: {
        assert: '@node/assert',
        scan: './lib/lab.js#scan'
    },
    main() {
        this.add('test', function({assert, scan}) {

        });

        this.add({
            modules: {
                path: '@node/path'
            },
            main({assert, path}) {

            }
        })
    }
};
*/

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        // function assertPrototype(instance, prototype) {
        //     assert(Object.getPrototypeOf(instance) === prototype);
        // }

        this.add('core', function() {
            this.add('scan is mutable, compose is immutable', function() {
                const object = {foo: true};
                const scanned = scan(object);
                // const composed = compose(object);

                assert.deepEqual(scanned.value, object);
                assert(scanned.value !== object);
                // assert(composed.value !== object);
                // assert(typeof composed.value === 'object');
            });

            // this.add('object composition', function() {
            //     const dam = {name: 'dam', item: {name: 'sword'}};
            //     const seb = {name: 'seb', item: {price: 10}, age: 10};
            //     const expectedComposite = {name: 'seb', item: {name: 'sword', price: 10}, age: 10};

            //     const damElement = scan(dam);
            //     const sebElement = scan(seb);
            //     const damValue = damElement.value;
            //     const sebValue = sebElement.value;
            //     assert(damValue === dam);
            //     assert(sebValue === seb);
            //     assert(damElement.getProperty('name').descriptor.writable === true);

            //     const compositeElement = damElement.compose(sebElement);
            //     const compositeValue = compositeElement.value;
            //     assert.deepEqual(compositeValue, expectedComposite);
            //     assert.deepEqual(dam, {name: 'dam', item: {name: 'sword'}});
            // });

            // this.add('compose wo arg must create a new object', function() {
            //     const object = {
            //         item: {}
            //     };
            //     const element = compose(object);
            //     assert(element.value !== object);
            //     assert(element.value.item !== object.item);

            //     const composite = element.compose();
            //     assert(composite.value !== element.value);
            //     assert(composite.value.item !== element.value.item);
            // });

            // this.add('primitive overrides composite property value', function() {
            //     const object = {
            //         name: {}
            //     };
            //     const composite = compose(object).compose({
            //         name: true
            //     });
            //     assert(composite.value.name === true);
            // });

            // this.add('composite overrides primitive', function() {
            //     const object = {
            //         name: true
            //     };
            //     const composite = compose(object).compose({
            //         name: {}
            //     });
            //     assert(typeof composite.value.name === 'object');
            // });

            // this.add('construct must create new objects', function() {
            //     const object = {
            //         foo: true,
            //         item: {},
            //         values: [{}]
            //     };
            //     const composite = scan(object);
            //     const instance = composite.construct();
            //     assertPrototype(instance, object);
            //     assertPrototype(instance.item, object.item);
            //     assertPrototype(instance.values[0], object.values[0]);
            //     assert(instance.hasOwnProperty('foo') === false);
            // });
        });

        this.add('array', function() {
            // this.add('array concatenation', function() {
            //     const damFriends = ['seb', 'clément'];
            //     damFriends.foo = 'foo';
            //     const sandraFriends = ['sumaya'];
            //     sandraFriends.bar = 'bar';
            //     const expectedComposite = ['seb', 'clément', 'sumaya'];
            //     expectedComposite.foo = damFriends.foo;
            //     expectedComposite.bar = sandraFriends.bar;

            //     const damFriendsElement = scan(damFriends);
            //     const sandraFriendsElement = scan(sandraFriends);
            //     const compositeFriendsElement = damFriendsElement.compose(sandraFriendsElement);

            //     assert.deepEqual(compositeFriendsElement.value, expectedComposite);
            // });

            // this.add('scan + compose array', function() {
            //     const array = [0, 1];
            //     const arrayElement = scan(array);
            //     const composedArray = arrayElement.compose();
            //     assert(arrayElement.value === array);
            //     assert.deepEqual(composedArray.value, array);
            // });

            // this.add('compose array', function() {
            //     const array = [0, 1];
            //     const arrayElement = compose(array);

            //     assert.deepEqual(arrayElement.value, array);
            //     assert(arrayElement.value instanceof Array);
            //     assert(arrayElement.hasProperty('length'));
            // });

            // this.add('compose array in property', function() {
            //     const obj = {
            //         list: ['a', 'b']
            //     };
            //     const element = compose(obj);
            //     const composed = element.value;

            //     // because we composed object with an other the obj was "cloned"
            //     // if we used scan it would be different but as we can see the clone
            //     assert(composed !== obj);
            //     assert(composed.list !== obj.list);
            //     assert(element.value.list instanceof Array);
            // });

            // this.add('compose two array', function() {
            //     const firstArray = [1];
            //     const secondArray = [2, 3];
            //     const composedArray = compose(firstArray).compose(secondArray);
            //     assert(composedArray.value.length === 3);
            // });
        });

        // this.add('function', function() {
        //     this.add('function scan', function() {
        //         const fn = function() {};
        //         const element = scan(fn);
        //         element.compose();
        //     });

        //     this.add('function in properties', function() {
        //         const obj = {
        //             fn() {}
        //         };
        //         const element = scan(obj);
        //         element.compose();
        //     });
        // });
    }
};
