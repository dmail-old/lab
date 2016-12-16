/*
raf

- pouvoir créer des composer custom en passant des options
a-t-on besoin de recréer Element dans ce cas ?
que fait-on lorsqu'un composer scan un élément d'un autre composer il apelle valueOf() ?

- pouvoir modifier le comportement par défaut du composer sans parler des options
genre en ajoutant des branches et des éléments, mettons si je souhaitais composer des objet customs genre immutable.js
dans l'idée ce serais plutot simple c'est la même comportement que pour Map natif (même si on a pas encore le support pour cet objet)
- constructor composition
- éviter .children ou voir comment gérer ça parce qu'on va surement utiliser
properties au lieu de children et on aurait aussi besoin de entries
et properties sera une map et pas un tableau
- nice to have : limiter les nombres de fonctions exposée sur Element au minimum
autrement dit isIndexedProperty et tout ces trucs deviennent des fonctions pures utilisé comme helpers
et tout ce qui est relatif aux propriété dans un objet genre pour éviter la multiplication de getProperty, hasProperty etc
properties: {
    data: {
        foo: true
    },
    get(name) {},
    set(name, value) {}
}

- jsenv/util/structure/definition.js contains many clue of missing features
also replication.js in the same folder, section about Error line 594

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

import {compose} from './src/lab.js';

export default compose;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        // this.add('scan', function() {
        //     this.add('scanning object', function() {
        //         const object = {name: 'foo'};
        //         const scanned = scan(object);

        //         assert.deepEqual(scanned.value, object);
        //         // scan ne recréera pas l'objet mais doit réfléter son statut
        //         // assert(scanned.value !== object);
        //     });
        // });

        this.add('compose', function() {
            this.add('compose object', function() {
                const dam = {name: 'dam', item: {name: 'sword'}};
                const seb = {name: 'seb', item: {price: 10}, age: 10};
                const expectedComposite = {name: 'seb', item: {name: 'sword', price: 10}, age: 10};

                const compositeElement = compose(dam, seb);
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
                const composite = compose(object);
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

                const compositeFriendsElement = compose(damFriends, sandraFriends);
                const actualComposite = compositeFriendsElement.value;

                assert.deepEqual(actualComposite, expectedComposite);
                assert(actualComposite instanceof Array);
            });

            // this.add('scan + compose array', function() {
            //     const array = [0, 1];
            //     const arrayElement = compose(array);
            //     const composedArray = arrayElement.compose();
            //     const composite = composedArray.value;

            //     assert(arrayElement.value === array);
            //     assert.deepEqual(composedArray.value, array);
            //     assert(composite instanceof Array);
            // });

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
                const compositeValue = element.value;

                assert(compositeValue.length === 2);
                assert(compositeValue instanceof Array === false);
                assert(element.getCountTrackerProperty().data.value === compositeValue.length);
            });

            this.add('by arraylike', function() {
                const object = {0: 1, length: 1};
                const element = compose(object);
                const compositeValue = element.value;

                assert(compositeValue.length === 1);
                assert(element.getCountTrackerProperty().data.value === compositeValue.length);
            });
        });

        this.add('function', function() {
            this.add('function scan', function() {
                const fn = function() {};
                const element = compose(fn);
                element.compose();
            });

            this.add('function in properties', function() {
                const obj = {
                    fn() {}
                };
                const element = compose(obj);
                element.compose();
            });
        });
    }
};

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
