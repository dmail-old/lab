import {scan} from './lib/lab.js';
import './lib/primitive.js';
import {ObjectElement} from './lib/composite.js';

const baseElement = ObjectElement.create();
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
            assert(composedArray.value === array);
            assert(composedArray === arrayElement);
        });

        this.add('compose array', function() {
            const array = [0, 1];
            const arrayElement = compose(array);

            assert.deepEqual(arrayElement.value, array);
            assert((arrayElement.value instanceof Array));
            assert(arrayElement.hasProperty('length'));
        });

        this.add('compose array in property', function() {
            const obj = {
                list: ['a', 'b']
            };
            const element = compose(obj);
            const composed = element.value;

            // because we composed object with an other the obj was "cloned"
            // if we used scan it would be different but as we can see the clone is not deep
            assert(composed !== obj);
            assert(composed.list === obj.list);
            // assert(element.value.list instanceof Array);
        });

        this.add('compose two array into arraylike', function() {
            const firstArray = [1];
            const secondArray = [2, 3];
            const composedArray = compose(firstArray).compose(secondArray);
            assert(composedArray.value.length === 3);
        });

        // this.add('function ?', function() {
        //     // function have a circular structre because of prototype + constructor
        //     // for now we may ignore this until circular stucture are supported
        //     const functionElement = Lab.scan(function yep() {});
        //     console.log(functionElement);
        // });

        // this.add('element construct', function() {
        //     const dam = {name: 'dam', item: {name: 'sword'}};
        //     const damElement = Lab.scan(dam);
        //     const damInstanceA = damElement.construct();
        //     const damInstanceB = damElement.construct();

        //     // compile does the job but we want
        //     // element.construct that will call any .constructor method
        //     // and maybe do more

        //     assert.deepEqual(damInstanceA.item, dam.item);
        //     assert.deepEqual(damInstanceB.item, dam.item);
        //     assert(damInstanceA.item !== dam.item);
        //     assert(damInstanceB.item !== dam.item);
        // });
    }
};
