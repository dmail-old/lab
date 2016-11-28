import {scan} from './lib/lab.js';
import './lib/primitive.js';
import {ObjectElement} from './lib/composite.js';

const baseElement = ObjectElement.create();
// by default this baseElement reaction let the secondObject prevails
baseElement.reaction = baseElement.reaction.extend({
    produceComposite(firstObject, secondObject) {
        const firstValue = firstObject.value;
        const secondValue = secondObject.value;
        const combinedValue = secondObject.combine(firstValue, secondValue);
        const compositeObject = secondObject.createConstructor(combinedValue);

        return compositeObject;
    }
});
const compose = baseElement.compose.bind(baseElement);

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
        this.add('scan is mutable, compose is immutable', function() {
            const object = {};
            const scanned = scan(object);
            const composed = compose(object);

            assert(scanned.value === object);
            assert(composed.value !== object);
        });

        this.add('object composition', function() {
            const dam = {name: 'dam', item: {name: 'sword'}};
            const seb = {name: 'seb', item: {price: 10}, age: 10};
            const expectedComposite = {name: 'seb', item: {name: 'sword', price: 10}, age: 10};

            const damElement = scan(dam);
            const sebElement = scan(seb);
            const damValue = damElement.value;
            const sebValue = sebElement.value;
            assert(damValue === dam);
            assert(sebValue === seb);
            assert(damElement.getProperty('name').descriptor.writable === true);

            const compositeElement = damElement.compose(sebElement);
            const compositeValue = compositeElement.value;
            assert.deepEqual(compositeValue, expectedComposite);
            assert.deepEqual(dam, {name: 'dam', item: {name: 'sword'}});
        });

        this.add('compose wo arg must create a new object', function() {
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

        this.add('primitive overrides composite property value', function() {
            const object = {
                name: {}
            };
            const composite = compose(object).compose({
                name: true
            });
            assert(composite.value.name === true);
        });

        this.add('composite overrides primitive', function() {
            const object = {
                name: true
            };
            const composite = compose(object).compose({
                name: {}
            });
            assert(typeof composite.value.name === 'object');
        });

        this.add('array concatenation', function() {
            const damFriends = ['seb', 'clément'];
            const sandraFriends = ['sumaya'];
            const expectedComposite = ['seb', 'clément', 'sumaya'];
            // set some sparse properties on array to ensure they are composed as well
            damFriends.foo = 'foo';
            sandraFriends.bar = 'bar';
            expectedComposite.foo = damFriends.foo;
            expectedComposite.bar = sandraFriends.bar;

            const damFriendsElement = scan(damFriends);
            const sandraFriendsElement = scan(sandraFriends);
            const compositeFriendsElement = damFriendsElement.compose(sandraFriendsElement);

            assert.deepEqual(compositeFriendsElement.value, expectedComposite);
        });

        this.add('scan + compose array', function() {
            const array = [0, 1];
            const arrayElement = scan(array);
            const composedArray = arrayElement.compose();
            assert(arrayElement.value === array);
            assert.deepEqual(composedArray.value, array);
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
    }
};
