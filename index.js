/*

composable immutable class/prototype

https://github.com/stampit-org/stamp-specification#stamp-arguments

raf

- pouvoir modifier le comportement par défaut du composer sans parler des options
genre en ajoutant des branches et des éléments, mettons si je souhaitais composer des objet customs genre immutable.js
dans l'idée ce serais plutot simple c'est la même comportement que pour Map natif (même si on a pas encore le support pour cet objet)

j'avais pensé à un truc assez chiadé genre

const compose = composer();

compose.plugins; // list de plugin qui définissent le comportement de compose
// on pourrait aussi l'apeller behaviour, impelmentation, components
// un plugin c'est super simple c'est juste une list de cas nommés genre

const concatPlugin = {
    compose: [
        function() {}, // if ca
        function() {}, // do ça
    ]
    instantiate: [
        function() {}, // if ça
        function() {}, // do ça
    ]
};

ensuite on peut ajouter/supprimer des plugins dynamiquement même une fois le composer créé
les options ne servent qu'à préconfigurer certains plugins

si par exemple on souhait ajouter immutablejs on auras "juste" à faire
il manque match ici

ImmutableJSPlugin = {
    touchValue: [
        function() {
            // si la valeur est une instance de immutablejs
        },
        function() {
            // y'a juste rien à faire
        }
    ],
    combineValue: [
        function() {}, // if imutableJS instance
        function() {
            // mergeDeep both imutable js objects (if possible not sure Set & Map can be merged)
        }
    ]
};

je ne suis pas sur qu'on ait vraiment besoin de créer un MapSequenceElement enfin faut voir
en tous cas comme on peut le voir il manque cet aspect, comment faire pour avoir un comportement
spécifique selon la valeur ?

est ce qu'on pourrait faire ça :

plugins = [];
const Plugin = util.extend({
    constructor(is, properties) {
        this.is = is;
        this.properties = properties;
    }
});
ensuite bah lorsque le plugin is() match on récup properties et on s'en sers
pour fair een sorte que les propriétés de ce plugin s'applique
ça donne donc

const Element = util.extend();
Element.match = function() {
    // on parcoure tous les plugins et on instancie le bon
};

// bon attends y'a le concept de plugin et celui des éléments
// c'est juste qu'il faut permettre à du code externe de créer des éléments

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

import {compose, composer} from './src/lab.js';

export default compose;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
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

            this.add('composer with relative method binding', function() {
                const composeBind = composer({
                    functionBehaviour: 'composite',
                    bindMethod: true,
                    bindMethodImplementation: 'relative'
                });
                const composite = composeBind({
                    method() {
                        return this;
                    }
                });
                const compositeValue = composite.value;
                const compositeValueMethod = compositeValue.method;

                assert(compositeValue.method() === compositeValue, 'method thisValue is owner when attached');
                assert(compositeValueMethod() === compositeValue, 'method thisValue is owner when detached');
                assert(compositeValueMethod.valueOf().call(10) === 10, 'method thisValue is value passed to .call()');
                const instance = new compositeValueMethod(); // eslint-disable-line new-cap
                assert(instance !== compositeValue, 'method thisValue is value passed by js engine on new keyword');
            });
        });

        this.add('constructor composition', function() {
            var callId = 0;
            function spy(fn) {
                let lastCall = {
                    called: false
                };
                function spyFn() {
                    lastCall.this = this;
                    lastCall.args = arguments;
                    lastCall.id = callId;
                    lastCall.called = true;
                    callId++;

                    if (fn) {
                        lastCall.return = fn.apply(this, arguments);
                        return lastCall.return;
                    }
                }
                spyFn.lastCall = lastCall;
                return spyFn;
            }
            // faudrais un truc pour dire que les spy ne doivent pas être "cloné"
            // ça marche quand même parce que c'est une fois cloné que lastCall est mutate
            // mais bon

            this.add('basic', function() {
                const firstSpy = spy();
                const secondSpy = spy();
                const firstSpyLastCall = firstSpy.lastCall;
                const secondSpyLastCall = secondSpy.lastCall;
                const composite = compose({
                    constructor: firstSpy
                }, {
                    constructor: secondSpy
                });
                const args = [true];
                const instance = composite.construct.apply(composite, args);

                assert(firstSpyLastCall.called);
                assert(secondSpyLastCall.called);
                assert(firstSpyLastCall.id < secondSpyLastCall.id);
                assert(firstSpyLastCall.this === instance);
                assert(secondSpyLastCall.this === instance);
                assert.deepEqual(Array.from(firstSpyLastCall.args), args);
                assert.deepEqual(Array.from(secondSpyLastCall.args), args);
            });

            this.add('chained + return override', function() {
                const firstSpy = spy();
                const secondSpy = spy(function() {
                    return {};
                });
                const thirdSpy = spy();
                const composite = compose({
                    constructor: firstSpy
                }).compose({
                    constructor: secondSpy
                }).compose({
                    constructor: thirdSpy
                });
                const instance = composite.construct();
                const secondSpyLastCall = secondSpy.lastCall;
                const thirdSpyLastCall = thirdSpy.lastCall;

                assert(thirdSpyLastCall.this === secondSpyLastCall.return);
                assert(instance === secondSpyLastCall.return);
            });
        });

        this.add('composer communication', function() {
            const value = {foo: true};
            const composeSpecial = composer();
            const normalComposite = compose(value);
            const specialComposite = composeSpecial(normalComposite);

            assert.deepEqual(specialComposite.value, normalComposite.value);
            assert(specialComposite.value !== normalComposite.value);
        });

        this.add('augment existing object', function() {
            // https://github.com/stampit-org/stampit/issues/153
            const object = {item: {name: 'sword'}};
            const composite = compose({item: {price: 100}, foo: true});
            composite.augment(object);
            assert(object.item.name === 'sword');
            assert(object.item.price === 100);
            assert(object.foo === true);

            // comment obtenir ça? je suppose
            // qu'un scan(object).compose(composite) esu suffisant
            // le seul "problème" c'est que dans ce cas précis le compose
            // ne dois pas être immutable
            // sinon on pourrais écrire comme ça : scan(object).compose(composite).value
            // et on aurais le résultat attendu
            // je dis : ne favorisons pas une API mutable
        }).skip('avoid mutability');
    }
};

/*
- chaque test à une méthode skip() ben ajouter aussi une méthode skipOthers pour en gros ne faire que celui la
de sorte que lorsqu'on test un seul truc on a pas les autres tests qui interfère

- amélioration de unit test afin d'éviter le problème que lorsqu'on comment un module
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
