/*
raf

- limiter les nombres de fonctions exposée sur Element au minimum
autrement dit isIndexedProperty et tout ces trucs deviennent des fonctions pures utilisé comme helpers
et tout ce qui est relatif aux propriété dans un objet genre pour éviter la multiplication de getProperty, hasProperty etc
properties: {
    data: {
        foo: true
    },
    get(name) {},
    set(name, value) {}
}

- ça serais bien, pour le plaisir et pour voir si on peut vraiment faire ce qu'on veut avec lab.js
de faire une composer qui aurait le "même" comportement que stampit juste en utilisant ce qu'on a à disposition
par "même comportement" j'entends un truc genre
const model = {
    constructor() {

    },
    methods: {

    },
    properties: {

    },
    deepProperties: {

    },
    configuration: {

    },
    deepConfiguration: {

    },
    static: {

    },
    deepStatic: {

    }
};
const composite = compose(model);

composite.value se retrouverait alors avec tout ces propriétés set sur lui
composite.value.methods === model.methods
par contre quand je fais
- composite.compose()
-> constructors sont mis ensemble
-> methods sont assign sur un nouvel objet
-> properties sont assign sur un nouvel objet
-> deepProperties sont merge sur un nouvel objet
-> configuration sont assign sur un nouvel objet
-> deepConfiguration sont merge sur un nouvel objet
-> static sont assign sur un nouvel objet
-> deepStatic sont merge sur un nouvel objet
- const instance = compose.construct();
-> methods sont assign et bound sur instance
-> properties, deepProperties sont assign sur instance
-> configuration, deepConfiguration, static, deepStatic sont ignoré
-> les constructors sont appelé sr instance
*/

import {Element, scan} from './src/lab.js';

Element.refine({
    asElement() {
        // pointerNode will return the pointedElement
        // doing ctrl+c & ctrl+v on a symlink on windows copy the symlinked file and not the symlink
        return this;
    }
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
        this.add('scan', function() {
            this.add('scanning object', function() {
                const object = {name: 'foo'};
                const scanned = scan(object);

                assert.deepEqual(scanned.value, object);
                // scan ne recréera pas l'objet mais doit réfléter son statut
                // assert(scanned.value !== object);
            });
        });

        this.add('compose', function() {
            this.add('compose object', function() {
                const dam = {name: 'dam', item: {name: 'sword'}};
                const seb = {name: 'seb', item: {price: 10}, age: 10};
                const expectedComposite = {name: 'seb', item: {name: 'sword', price: 10}, age: 10};

                const damElement = scan(dam);
                const sebElement = scan(seb);
                const damValue = damElement.value;
                const sebValue = sebElement.value;
                assert.deepEqual(damValue, dam);
                assert.deepEqual(sebValue, seb);

                const compositeElement = damElement.compose(sebElement);
                const compositeValue = compositeElement.value;
                assert.deepEqual(compositeValue, expectedComposite);
                assert.deepEqual(dam, {name: 'dam', item: {name: 'sword'}}, 'compose does not mutate ingredients');
            });

            this.add('compose without argument', function() {
                const object = {
                    item: {}
                };
                const element = compose(object);
                assert(element.value !== object);
                assert(element.value.item !== object.item);

                const composite = element.compose();
                assert(composite.value !== element.value);
                assert(composite.value.item !== element.value.item);
            });

            this.add('compose object + primitive property', function() {
                const object = {
                    name: {}
                };
                const composite = compose(object).compose({
                    name: true
                });
                assert(composite.value.name === true);
            });

            this.add('composite primitive + object property', function() {
                const object = {
                    name: true
                };
                const composite = compose(object).compose({
                    name: {}
                });
                assert(typeof composite.value.name === 'object');
            });
        });

        this.add('construct', function() {
            function assertPrototype(instance, prototype) {
                assert(Object.getPrototypeOf(instance) === prototype);
            }

            this.add('construct must create new objects', function() {
                const object = {
                    foo: true,
                    item: {},
                    values: [{}]
                };
                const composite = scan(object);
                const model = composite.value;
                const instance = composite.construct();
                assertPrototype(instance, model);
                assertPrototype(instance.item, model.item);
                assertPrototype(instance.values[0], model.values[0]);
                assert(instance.hasOwnProperty('foo') === false);
            });
        });

        this.add('array', function() {
            this.add('array concatenation', function() {
                const damFriends = ['seb', 'clément'];
                damFriends.foo = 'foo';
                const sandraFriends = ['sumaya'];
                sandraFriends.bar = 'bar';
                const expectedComposite = ['seb', 'clément', 'sumaya'];
                expectedComposite.foo = damFriends.foo;
                expectedComposite.bar = sandraFriends.bar;

                const damFriendsElement = scan(damFriends);
                const sandraFriendsElement = scan(sandraFriends);
                const compositeFriendsElement = damFriendsElement.compose(sandraFriendsElement);
                const actualComposite = compositeFriendsElement.value;

                assert.deepEqual(actualComposite, expectedComposite);
                assert(actualComposite instanceof Array);
            });

            this.add('scan + compose array', function() {
                const array = [0, 1];
                const arrayElement = scan(array);
                const composedArray = arrayElement.compose();
                const composite = composedArray.value;

                assert(arrayElement.value === array);
                assert.deepEqual(composedArray.value, array);
                assert(composite instanceof Array);
            });

            this.add('compose array', function() {
                const array = [0, 1];
                const arrayElement = compose(array);

                assert.deepEqual(arrayElement.value, array);
                assert(arrayElement.value instanceof Array);
                assert(arrayElement.hasProperty('length'));
            });

            this.add('compose array in property', function() {
                const obj = {
                    list: ['a', 'b']
                };
                const element = compose(obj);
                const composed = element.value;

                // because we composed object with an other the obj was "cloned"
                // if we used scan it would be different but as we can see the clone
                assert(composed !== obj);
                assert(composed.list !== obj.list);
                assert(element.value.list instanceof Array);
            });

            this.add('compose two array', function() {
                const firstArray = [1];
                const secondArray = [2, 3];
                const composedArray = compose(firstArray).compose(secondArray);
                assert(composedArray.value.length === 3);
            });
        });

        this.add('arraylike', function() {
            this.add('by object + array', function() {
                const object = {foo: true, 1: 'b'};
                const array = [];
                const element = compose(object, array);
                const arrayLike = element.value;

                assert(arrayLike.length === 1);
                assert(arrayLike instanceof Array === false);
                assert(element.getProperty('length').data.value === arrayLike.length, 'length is in sync');
            });

            this.add('by object + arraylike', function() {
                const object = {foo: true, 0: 1};
                const arraylike = {1: 0, length: 1};
                const element = compose(object, arraylike);
                const composite = element.value;

                assert(composite.length === 2);
                assert(composite instanceof Array === false);
                assert(element.getCountTrackerProperty().data.value === composite.length);
            });

            this.add('by arraylike', function() {
                const object = {0: 1, length: 1};
                const element = scan(object).compose();
                const composite = element.value;

                assert(composite.length === 1);
                assert(element.getCountTrackerProperty().data.value === composite.length);
            });
        });

        this.add('function', function() {
            this.add('function scan', function() {
                const fn = function() {};
                const element = scan(fn);
                element.compose();
            });

            this.add('function in properties', function() {
                const obj = {
                    fn() {}
                };
                const element = scan(obj);
                element.compose();
            });
        });
    }
};
